/// <reference types="jest" />

import { act, cleanup, render, screen } from '@testing-library/react-native';

jest.unmock('@/offline/components/OfflineIndicator');

import OfflineIndicator from '@/offline/components/OfflineIndicator';

let mockOnline = true;

jest.mock('@/offline/hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => mockOnline,
}));

afterEach(cleanup);

test('shows connection messages only when the connection changes', async () => {
  const view = render(<OfflineIndicator />);
  await act(async () => Promise.resolve());
  expect(screen.queryByText('Back online. Syncing...')).toBeNull();
  mockOnline = false;
  view.rerender(<OfflineIndicator />);
  expect(screen.getByText('You are offline. Changes will sync when reconnected.')).toBeTruthy();
  mockOnline = true;
  view.rerender(<OfflineIndicator />);
  expect(screen.getByText('Back online. Syncing...')).toBeTruthy();
  view.unmount();
});
