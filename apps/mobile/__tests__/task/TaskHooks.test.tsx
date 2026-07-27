/// <reference types="jest" />

import 'fake-indexeddb/auto';

import { useCurrentUser } from '@/auth/hooks/useCurrentUser';
import { createAuthenticatedSession } from '@/auth/offlineSession';
import { deleteOfflineDatabase, saveAuthRecord } from '@/offline/database';
import { createLocalTask } from '@/offline/taskStore';
import useCreateTask from '@/task/hooks/useCreateTask';
import useDeleteTask from '@/task/hooks/useDeleteTask';
import useReadTask from '@/task/hooks/useReadTask';
import useReadTasks from '@/task/hooks/useReadTasks';
import useUpdateTask from '@/task/hooks/useUpdateTask';
import type { ModifyTaskData } from '@/task/schema';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { Pressable, Text } from 'react-native';

const USER_ID = '9b97c715-d720-4ffc-88e6-f395be319dda';

function values(title: string): ModifyTaskData {
  return {
    title,
    description: 'Offline',
    due_at: '2026-08-01T09:00:00.000Z',
    subtasks: [
      {
        id: crypto.randomUUID(),
        title: 'First',
        description: '',
        est_m: 15,
        is_done: false,
        depends_on: [],
      },
    ],
  };
}

async function seedSession(): Promise<void> {
  await saveAuthRecord(
    createAuthenticatedSession(
      'http://localhost:8000',
      {
        id: USER_ID,
        email: 'offline@example.com',
        username: 'offline',
        is_active: true,
        is_superuser: false,
        is_verified: false,
        server_time: '2026-07-27T09:00:00.000Z',
        session_expires_at: '2027-07-27T09:00:00.000Z',
      },
      Date.now(),
    ),
  );
}

function CreateProbe() {
  const { data: currentUser } = useCurrentUser();
  const tasks = useReadTasks();
  const create = useCreateTask();
  const titles = tasks.data?.pages.flat().map((task) => task.title) ?? [];
  return (
    <>
      <Text>{currentUser ? 'Ready' : 'Checking'}</Text>
      <Text>{titles.join(',') || 'Empty'}</Text>
      <Pressable
        accessibilityLabel="Create offline"
        onPress={() => create.mutate(values('Created'))}
      >
        <Text>Create</Text>
      </Pressable>
    </>
  );
}

function ExistingProbe({ taskId }: { taskId: string }) {
  const task = useReadTask(taskId);
  const update = useUpdateTask(taskId);
  const remove = useDeleteTask(taskId);
  return (
    <>
      <Text>{task.data?.title ?? 'Missing'}</Text>
      <Pressable
        accessibilityLabel="Update offline"
        onPress={() => update.mutate({ ...values('Updated'), id: taskId })}
      >
        <Text>Update</Text>
      </Pressable>
      <Pressable accessibilityLabel="Delete offline" onPress={() => remove.mutate()}>
        <Text>Delete</Text>
      </Pressable>
    </>
  );
}

function renderProbe(ui: ReactElement): {
  queryClient: QueryClient;
  unmount: () => void;
} {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { gcTime: Infinity, retry: false },
      queries: { gcTime: Infinity, retry: false },
    },
  });
  const view = render(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
  return {
    queryClient,
    unmount: () => {
      view.unmount();
      queryClient.clear();
    },
  };
}

beforeEach(async () => {
  await deleteOfflineDatabase();
  await seedSession();
  Object.defineProperty(globalThis.navigator, 'onLine', {
    configurable: true,
    value: false,
  });
  globalThis.fetch = jest.fn() as unknown as typeof fetch;
});

afterAll(async () => {
  await deleteOfflineDatabase();
});

test('creates and lists a task offline with an account-scoped query key', async () => {
  const view = renderProbe(<CreateProbe />);
  try {
    expect(await screen.findByText('Ready')).toBeTruthy();
    expect(await screen.findByText('Empty')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Create offline'));
    expect(await screen.findByText('Created')).toBeTruthy();
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(
      view.queryClient
        .getQueryCache()
        .getAll()
        .some(
          (query) =>
            JSON.stringify(query.queryKey) === JSON.stringify(['task', USER_ID, 'list', 20]),
        ),
    ).toBe(true);
  } finally {
    view.unmount();
  }
});

test('reads, updates, and deletes an existing task offline after reload', async () => {
  const task = await createLocalTask(USER_ID, values('Stored'), '2026-07-27T09:00:00.000Z');
  const view = renderProbe(<ExistingProbe taskId={task.id} />);
  try {
    expect(await screen.findByText('Stored')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Update offline'));
    expect(await screen.findByText('Updated')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Delete offline'));
    await waitFor(() => expect(screen.getByText('Missing')).toBeTruthy());
    expect(globalThis.fetch).not.toHaveBeenCalled();
  } finally {
    view.unmount();
  }
});
