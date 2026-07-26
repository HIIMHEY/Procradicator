/// <reference types="jest" />

import { useCurrentUser } from '@/auth/hooks/useCurrentUser';
import { API_ROUTES } from '@/config/env';
import { FriendsPage } from '@/friends/components/FriendsPage';
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { friendId, linkId, response, userId } from '../../test-utils/friendTestUtils';
import { renderWithProviders } from '../../test-utils/renderWithProviders';

const mockFetch = jest.fn();
const mockReplace = jest.fn();

jest.mock('@/auth/hooks/useCurrentUser');
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

const mockUseCurrentUser = jest.mocked(useCurrentUser);

beforeEach(() => {
  mockFetch.mockReset();
  mockReplace.mockReset();
  mockUseCurrentUser.mockReset();
  mockUseCurrentUser.mockReturnValue({ data: { id: userId } } as never);
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

test('separates incoming and sent requests and rejects an incoming request', async () => {
  const sentLinkId = '6cf34c16-a0f8-4dae-97cd-c5a04304f44c';
  let rejected = false;
  mockFetch.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === API_ROUTES.FRIENDS.BASE || url === API_ROUTES.FRIENDS.PROGRESS) {
      return Promise.resolve(response([]));
    }
    if (url === API_ROUTES.FRIENDS.REQUEST(linkId) && init?.method === 'DELETE') {
      rejected = true;
      return Promise.resolve(response(null, 204));
    }
    if (url === API_ROUTES.FRIENDS.REQUESTS) {
      return Promise.resolve(
        response([
          ...(!rejected
            ? [
                {
                  id: linkId,
                  user: { id: friendId, username: 'test_person_1' },
                  requested_at: '2026-07-25T12:00:00Z',
                  accepted_at: null,
                  is_incoming: true,
                },
              ]
            : []),
          {
            id: sentLinkId,
            user: {
              id: '4c3482b1-b1fd-46f0-a435-e312867f7610',
              username: 'test_person_2',
            },
            requested_at: '2026-07-25T12:10:00Z',
            accepted_at: null,
            is_incoming: false,
          },
        ]),
      );
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
  renderWithProviders(<FriendsPage />);
  fireEvent.press(screen.getByRole('tab', { name: 'Requests' }));
  await screen.findByText('test_person_1');
  const incoming = screen.getByLabelText('Incoming friend requests');
  const sent = screen.getByLabelText('Sent friend requests');
  expect(within(incoming).getByText('test_person_1')).toBeTruthy();
  expect(within(sent).getByText('test_person_2')).toBeTruthy();
  expect(within(sent).getByText('Pending')).toBeTruthy();
  fireEvent.press(within(incoming).getByRole('button', { name: 'Reject test_person_1' }));
  await waitFor(() => {
    expect(screen.queryByText('test_person_1')).toBeNull();
  });
});

test('accepts an incoming friend request', async () => {
  let accepted = false;
  mockFetch.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === API_ROUTES.FRIENDS.BASE || url === API_ROUTES.FRIENDS.PROGRESS) {
      return Promise.resolve(response([]));
    }
    if (url === API_ROUTES.FRIENDS.REQUEST(linkId) && init?.method === 'PATCH') {
      accepted = true;
      return Promise.resolve(response(null, 204));
    }
    if (url === API_ROUTES.FRIENDS.REQUESTS) {
      return Promise.resolve(
        response(
          accepted
            ? []
            : [
                {
                  id: linkId,
                  user: { id: friendId, username: 'test_person_1' },
                  requested_at: '2026-07-25T12:00:00Z',
                  accepted_at: null,
                  is_incoming: true,
                },
              ],
        ),
      );
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
  renderWithProviders(<FriendsPage />);
  fireEvent.press(screen.getByRole('tab', { name: 'Requests' }));
  const acceptButton = await screen.findByRole('button', { name: 'Accept test_person_1' });
  fireEvent.press(acceptButton);
  await waitFor(() => {
    expect(screen.queryByText('test_person_1')).toBeNull();
  });
});

test('shows a requests error and retries to the empty state', async () => {
  let requestReads = 0;
  mockFetch.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url === API_ROUTES.FRIENDS.BASE || url === API_ROUTES.FRIENDS.PROGRESS) {
      return Promise.resolve(response([]));
    }
    if (url === API_ROUTES.FRIENDS.REQUESTS) {
      requestReads += 1;
      return Promise.resolve(requestReads === 1 ? response({}, 503) : response([]));
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
  renderWithProviders(<FriendsPage />);
  fireEvent.press(screen.getByRole('tab', { name: 'Requests' }));
  expect(await screen.findByLabelText('Requests error state')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Retry requests' }));
  expect(await screen.findByLabelText('Requests empty state')).toBeTruthy();
});
