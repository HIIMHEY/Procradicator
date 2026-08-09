import 'fake-indexeddb/auto';

jest.unmock('@/offline/components/OfflineSyncProvider');
jest.unmock('@/offline/components/ConflictModal');

import OfflineSyncProvider from '@/offline/components/OfflineSyncProvider';
import ConflictModal from '@/offline/components/ConflictModal';
import { AUTH_API_ORIGIN, persistLocalLogout } from '@/auth/sessionManager';
import { createAuthSession } from '@/auth/offlineSession';
import { saveAuthRecord } from '@/offline/database';
import { createLocalFocusSession, saveLocalFocusProgress } from '@/offline/focusStore';
import { flushTaskOutbox } from '@/offline/taskSync';
import { createLocalTask, deleteLocalTask, updateLocalTask } from '@/offline/taskStore';
import { API_ROUTES } from '@/config/env';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { response } from '../../test-utils/http';
import { iso, uid } from '../../test-utils/factories';
import { createTestQueryClient } from '../../test-utils/renderWithProviders';
import { resetOfflineDatabase, setOnline } from '../../test-utils/offline';
import { stubWindowEvents } from '../../test-utils/windowEvents';

let mockCurrentUser: { id: string } | null = null;

jest.mock('@/auth/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ data: mockCurrentUser }),
}));

const user = {
  id: uid('user'),
  email: 'user@example.com',
  username: 'user',
  is_active: true,
  is_superuser: false,
  is_verified: false,
  server_time: iso(0),
  session_expires_at: iso(60),
};

function renderSyncProvider(showConflicts = false) {
  const queryClient = createTestQueryClient();
  const view = render(
    <>
      <OfflineSyncProvider />
      {showConflicts && <ConflictModal />}
    </>,
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    },
  );
  return { ...view, queryClient };
}

beforeEach(async () => {
  await resetOfflineDatabase();
  stubWindowEvents();
  globalThis.fetch = jest.fn() as unknown as typeof fetch;
  setOnline(false);
  mockCurrentUser = null;
});

afterAll(async () => {
  await resetOfflineDatabase();
});

test('sends a queued logout when the browser reconnects', async () => {
  await saveAuthRecord(createAuthSession(AUTH_API_ORIGIN, user, Date.now()));
  await persistLocalLogout();
  jest.mocked(globalThis.fetch).mockResolvedValue(response());

  const view = renderSyncProvider();
  try {
    setOnline(true);
    act(() => window.dispatchEvent(new Event('online')));
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(API_ROUTES.AUTH.LOGOUT, {
        method: 'POST',
        credentials: 'include',
      });
    });
  } finally {
    view.unmount();
    view.queryClient.clear();
  }
});

test('runs one sync while reconnect events overlap', async () => {
  mockCurrentUser = { id: user.id };
  setOnline(true);
  let resolveResponse: ((value: Response) => void) | undefined;
  jest.mocked(globalThis.fetch).mockImplementation(
    () =>
      new Promise<Response>((resolve) => {
        resolveResponse ??= resolve;
      }),
  );

  const view = renderSyncProvider();
  try {
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
    act(() => {
      window.dispatchEvent(new Event('online'));
      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new Event('procradicator:task-sync'));
    });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveResponse?.(response([]));
      await Promise.resolve();
    });
  } finally {
    view.unmount();
    view.queryClient.clear();
  }
});

test('syncs user data when the user loads during a pending logout', async () => {
  await saveAuthRecord(createAuthSession(AUTH_API_ORIGIN, user, Date.now()));
  await persistLocalLogout();
  setOnline(true);
  let finishLogout: ((value: Response) => void) | undefined;
  jest.mocked(globalThis.fetch).mockImplementation((url) => {
    if (url === API_ROUTES.AUTH.LOGOUT) {
      return new Promise<Response>((resolve) => {
        finishLogout = resolve;
      });
    }
    if (String(url).startsWith(API_ROUTES.TASKS.BASE)) {
      return Promise.resolve(response([]));
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });

  const view = renderSyncProvider();
  try {
    await waitFor(() =>
      expect(globalThis.fetch).toHaveBeenCalledWith(API_ROUTES.AUTH.LOGOUT, {
        method: 'POST',
        credentials: 'include',
      }),
    );
    mockCurrentUser = { id: user.id };
    view.rerender(<OfflineSyncProvider />);
    await act(async () => {
      finishLogout?.(response());
      await Promise.resolve();
    });
    await waitFor(() =>
      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${API_ROUTES.TASKS.BASE}?page=1&limit=100`,
        expect.objectContaining({ method: 'GET', credentials: 'include' }),
      ),
    );
  } finally {
    view.unmount();
    view.queryClient.clear();
  }
});

test('syncs focus progress before deleting its task after reconnect', async () => {
  mockCurrentUser = { id: user.id };
  const task = await createLocalTask(user.id, {
    title: 'Offline task',
    description: '',
    due_at: iso(0),
    subtasks: [
      {
        id: uid('subtask'),
        title: 'Review notes',
        description: '',
        est_m: 25,
        is_done: false,
        depends_on: [],
      },
    ],
  });
  await createLocalFocusSession(user.id, task.id, task.subtasks[0].id, 0);
  await deleteLocalTask(user.id, task.id);
  let taskDeleted = false;
  jest.mocked(globalThis.fetch).mockImplementation(async (url, options) => {
    const method = options?.method;
    if (url === API_ROUTES.TASKS.BASE && method === 'POST') {
      return response({ ...task, updated_at: iso(10), version: 1 }, 201);
    }
    if (url === API_ROUTES.FOCUS.BASE && method === 'POST') {
      if (taskDeleted) return response({}, 404);
      const body = JSON.parse(String(options?.body));
      return response(
        {
          ...body,
          user_id: user.id,
          updated_at: body.start_at,
          end_at: null,
          version: 1,
          work_cycles: 0,
          rest_cycles: 0,
          total_overtime_s: 0,
          abandon_reason: null,
        },
        201,
      );
    }
    if (url === API_ROUTES.TASKS.DETAIL(task.id) && method === 'DELETE') {
      taskDeleted = true;
      return response({}, 204);
    }
    if (String(url).startsWith(API_ROUTES.TASKS.BASE) && method === 'GET') {
      return response([]);
    }
    return response({}, 500);
  });

  const view = renderSyncProvider();
  try {
    await act(async () => Promise.resolve());
    expect(globalThis.fetch).not.toHaveBeenCalled();
    setOnline(true);
    act(() => window.dispatchEvent(new Event('online')));
    await waitFor(() => {
      const writes = jest
        .mocked(globalThis.fetch)
        .mock.calls.filter(([, options]) => options?.method !== 'GET')
        .map(([url, options]) => [options?.method, url]);
      expect(writes).toEqual([
        ['POST', API_ROUTES.TASKS.BASE],
        ['POST', API_ROUTES.FOCUS.BASE],
        ['DELETE', API_ROUTES.TASKS.DETAIL(task.id)],
      ]);
    });
  } finally {
    view.unmount();
    view.queryClient.clear();
  }
});

test('shows a task conflict immediately after reconnect', async () => {
  mockCurrentUser = { id: user.id };
  const task = await createLocalTask(user.id, {
    title: 'Original',
    description: '',
    due_at: iso(0),
    subtasks: [
      {
        id: crypto.randomUUID(),
        title: 'Review notes',
        description: '',
        est_m: 25,
        is_done: false,
        depends_on: [],
      },
    ],
  });
  jest
    .mocked(globalThis.fetch)
    .mockResolvedValueOnce(response({ ...task, updated_at: iso(10), version: 1 }, 201));
  await flushTaskOutbox(user.id);
  await updateLocalTask(user.id, task.id, {
    id: task.id,
    title: 'Mine',
    description: '',
    due_at: task.due_at,
    subtasks: task.subtasks.map((subtask) => ({
      id: subtask.id,
      title: subtask.title,
      description: subtask.description ?? undefined,
      est_m: subtask.est_m,
      is_done: subtask.is_done,
      depends_on: [],
    })),
  });
  const serverTask = {
    ...task,
    title: 'Server',
    updated_at: iso(12),
    version: 2,
  };
  jest.mocked(globalThis.fetch).mockImplementation(async (url, options) => {
    if (options?.method === 'PUT') {
      return response({ detail: 'Task changed on the server', server: serverTask }, 412);
    }
    if (String(url).startsWith(API_ROUTES.TASKS.BASE) && options?.method === 'GET') {
      return response([serverTask]);
    }
    return response({}, 500);
  });

  const view = renderSyncProvider(true);
  try {
    await act(async () => Promise.resolve());
    setOnline(true);
    act(() => window.dispatchEvent(new Event('online')));
    await waitFor(() =>
      expect(
        jest.mocked(globalThis.fetch).mock.calls.some(([, options]) => options?.method === 'PUT'),
      ).toBe(true),
    );
    expect(await screen.findByText('Conflict Detected')).toBeTruthy();
    expect(screen.getByText('Mine')).toBeTruthy();
    expect(screen.getByText('Server')).toBeTruthy();
  } finally {
    view.unmount();
    view.queryClient.clear();
  }
});

test('shows a focus conflict immediately after reconnect', async () => {
  mockCurrentUser = { id: user.id };
  const session = {
    id: uid('focus-session'),
    user_id: user.id,
    start_at: iso(0),
    updated_at: iso(0),
    end_at: null,
    version: 1,
    work_cycle_m: 25,
    rest_cycle_m: 5,
    work_cycles: 0,
    rest_cycles: 0,
    total_overtime_s: 0,
    abandon_reason: null,
  };
  const local = await createLocalFocusSession(
    user.id,
    uid('task'),
    uid('subtask'),
    0,
    session.start_at,
    session,
  );
  await saveLocalFocusProgress(
    user.id,
    session.id,
    { ...local.state, completedIds: [local.subtaskId] },
    {
      focus_logs: [],
      rest_logs: [],
      completed_subtask_ids: [local.subtaskId],
      work_cycles: 0,
      rest_cycles: 0,
      total_overtime_s: 0,
    },
    false,
    iso(25),
  );
  const server = {
    ...session,
    updated_at: iso(20),
    version: 2,
    work_cycles: 1,
  };
  jest.mocked(globalThis.fetch).mockImplementation(async (url, options) => {
    if (url === API_ROUTES.FOCUS.DETAIL(session.id) && options?.method === 'PATCH') {
      return response({ detail: 'Focus session changed on the server', server }, 412);
    }
    if (String(url).startsWith(API_ROUTES.TASKS.BASE) && options?.method === 'GET') {
      return response([]);
    }
    return response({}, 500);
  });

  const view = renderSyncProvider(true);
  try {
    setOnline(true);
    act(() => window.dispatchEvent(new Event('online')));
    expect(await screen.findByText('Conflict Detected')).toBeTruthy();
    expect(screen.getByText('1 completed subtasks')).toBeTruthy();
    expect(screen.getByText('1 work cycles')).toBeTruthy();
  } finally {
    view.unmount();
    view.queryClient.clear();
  }
});
