jest.unmock('@/offline/components/ConflictModal');

import ConflictModal from '@/offline/components/ConflictModal';
import { keepLocalTask, keepServerTask, listTaskConflicts } from '@/offline/taskSync';
import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { createTestQueryClient } from '../../test-utils/renderWithProviders';
import { iso, uid } from '../../test-utils/factories';

const mockUserId = uid('user');

jest.mock('@/auth/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: { id: mockUserId },
    isPending: false,
  }),
}));

jest.mock('@/offline/taskSync', () => ({
  keepLocalTask: jest.fn(),
  keepServerTask: jest.fn(),
  listTaskConflicts: jest.fn(),
}));

jest.mock('@/offline/focusSync', () => ({
  keepLocalFocus: jest.fn(),
  keepServerFocus: jest.fn(),
  listFocusConflicts: jest.fn().mockResolvedValue([]),
}));

const conflict = {
  id: uid('conflict'),
  userId: mockUserId,
  entityId: uid('task'),
  operation: 'update' as const,
  localTask: {
    id: uid('task'),
    title: 'Mine',
    due_at: iso(0),
    updated_at: iso(5),
    version: 1,
    subtasks: [],
  },
  serverTask: {
    id: uid('task'),
    title: 'Server',
    due_at: iso(0),
    updated_at: iso(6),
    version: 2,
    subtasks: [],
  },
  baseVersion: 1,
  createdAt: iso(6),
};
let taskConflicts = [conflict];

function renderModal() {
  const queryClient = createTestQueryClient();
  const view = render(<ConflictModal />, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
  return {
    ...view,
    cleanup: () => {
      view.unmount();
      queryClient.clear();
    },
  };
}

beforeEach(() => {
  globalThis.fetch = jest.fn() as unknown as typeof fetch;
  taskConflicts = [conflict];
  jest
    .mocked(listTaskConflicts)
    .mockReset()
    .mockImplementation(async () => taskConflicts);
  jest
    .mocked(keepLocalTask)
    .mockReset()
    .mockImplementation(async () => {
      taskConflicts = [];
    });
  jest
    .mocked(keepServerTask)
    .mockReset()
    .mockImplementation(async () => {
      taskConflicts = [];
    });
});

test('offers both task versions and closes after keeping local', async () => {
  const view = renderModal();
  try {
    expect(await screen.findByText('Conflict Detected')).toBeTruthy();
    expect(screen.getByText('Mine')).toBeTruthy();
    expect(screen.getByText('Server')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Keep mine' }));
    await waitFor(() => expect(screen.queryByText('Conflict Detected')).toBeNull());
    expect(globalThis.fetch).not.toHaveBeenCalled();
  } finally {
    view.cleanup();
  }
});

test('closes after choosing the server copy', async () => {
  const view = renderModal();
  try {
    expect(await screen.findByText('Conflict Detected')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Keep server' }));
    await waitFor(() => expect(screen.queryByText('Conflict Detected')).toBeNull());
  } finally {
    view.cleanup();
  }
});
