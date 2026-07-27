/// <reference types="jest" />

jest.unmock('@/offline/components/ConflictModal');

import ConflictModal from '@/offline/components/ConflictModal';
import { keepLocalTask, keepServerTask, listTaskConflicts } from '@/offline/taskSync';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

jest.mock('@/auth/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: { id: '9b97c715-d720-4ffc-88e6-f395be319dda' },
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
  id: '6ebca865-95b8-4128-b1a5-6c41897cd4df',
  userId: '9b97c715-d720-4ffc-88e6-f395be319dda',
  entityId: 'd06dd4a2-f96a-4f31-a5e1-abd85acfe28d',
  operation: 'update' as const,
  localTask: {
    id: 'd06dd4a2-f96a-4f31-a5e1-abd85acfe28d',
    title: 'Mine',
    due_at: '2026-08-01T09:00:00.000Z',
    updated_at: '2026-07-27T09:05:00.000Z',
    version: 1,
    subtasks: [],
  },
  serverTask: {
    id: 'd06dd4a2-f96a-4f31-a5e1-abd85acfe28d',
    title: 'Server',
    due_at: '2026-08-01T09:00:00.000Z',
    updated_at: '2026-07-27T09:06:00.000Z',
    version: 2,
    subtasks: [],
  },
  baseVersion: 1,
  createdAt: '2026-07-27T09:06:00.000Z',
};

function renderModal() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { gcTime: Infinity, retry: false },
      queries: { gcTime: Infinity, retry: false },
    },
  });
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
  jest.mocked(listTaskConflicts).mockReset().mockResolvedValue([conflict]);
  jest.mocked(keepLocalTask).mockReset().mockResolvedValue();
  jest.mocked(keepServerTask).mockReset().mockResolvedValue();
});

test('offers both task versions and keeps local without a request', async () => {
  const originalDispatch = window.dispatchEvent;
  window.dispatchEvent = jest.fn();
  const view = renderModal();
  try {
    expect(await screen.findByText('Conflict Detected')).toBeTruthy();
    expect(screen.getByText('Mine')).toBeTruthy();
    expect(screen.getByText('Server')).toBeTruthy();
    fireEvent.press(screen.getByText('Keep Mine'));
    await waitFor(() => expect(keepLocalTask).toHaveBeenCalledWith(conflict));
    await waitFor(() =>
      expect(window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'procradicator:task-sync' }),
      ),
    );
    expect(globalThis.fetch).not.toHaveBeenCalled();
  } finally {
    window.dispatchEvent = originalDispatch;
    view.cleanup();
  }
});

test('can choose the server copy', async () => {
  const view = renderModal();
  try {
    expect(await screen.findByText('Conflict Detected')).toBeTruthy();
    fireEvent.press(screen.getByText('Keep Server'));
    await waitFor(() => expect(keepServerTask).toHaveBeenCalledWith(conflict));
  } finally {
    view.cleanup();
  }
});
