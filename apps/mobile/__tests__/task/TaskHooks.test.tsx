import 'fake-indexeddb/auto';

import { useCurrentUser } from '@/auth/hooks/useCurrentUser';
import { createLocalTask } from '@/offline/taskStore';
import useCreateTask from '@/task/hooks/useCreateTask';
import useDeleteTask from '@/task/hooks/useDeleteTask';
import useReadTask from '@/task/hooks/useReadTask';
import useReadTasks from '@/task/hooks/useReadTasks';
import useUpdateTask from '@/task/hooks/useUpdateTask';
import type { ModifyTaskData } from '@/task/schema';
import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { Pressable, Text } from 'react-native';
import { createTestQueryClient } from '../../test-utils/renderWithProviders';
import { iso, uid } from '../../test-utils/factories';
import { resetOfflineDatabase, seedOfflineSession, setOnline } from '../../test-utils/offline';

const USER_ID = uid('user');

function values(title: string): ModifyTaskData {
  return {
    title,
    description: 'Offline',
    due_at: iso(0),
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
  await seedOfflineSession(USER_ID);
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
  unmount: () => void;
} {
  const queryClient = createTestQueryClient();
  const view = render(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
  return {
    unmount: () => {
      view.unmount();
      queryClient.clear();
    },
  };
}

beforeEach(async () => {
  await resetOfflineDatabase();
  await seedSession();
  setOnline(false);
  globalThis.fetch = jest.fn() as unknown as typeof fetch;
});

afterAll(async () => {
  await resetOfflineDatabase();
});

test('creates and lists a task offline', async () => {
  const view = renderProbe(<CreateProbe />);
  try {
    expect(await screen.findByText('Ready')).toBeTruthy();
    expect(await screen.findByText('Empty')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Create offline'));
    expect(await screen.findByText('Created')).toBeTruthy();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  } finally {
    view.unmount();
  }
});

test('reads, updates, and deletes an existing task offline after reload', async () => {
  const task = await createLocalTask(USER_ID, values('Stored'), iso(0));
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
