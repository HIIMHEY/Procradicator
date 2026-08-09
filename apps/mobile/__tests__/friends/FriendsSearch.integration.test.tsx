import { friendId, linkId, response, stubFriendsFetch } from '../../test-utils/friendTestUtils';
import { iso } from '../../test-utils/factories';
import { API_ROUTES } from '@/config/env';
import { FriendsPage } from '@/friends/components/FriendsPage';
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { renderWithProviders } from '../../test-utils/renderWithProviders';

const mockFetch = jest.fn();

beforeEach(() => {
  mockFetch.mockReset();
  stubFriendsFetch(mockFetch);
});

test('searches for a user and sends a friend request', async () => {
  let sent = false;
  mockFetch.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === API_ROUTES.FRIENDS.BASE || url === API_ROUTES.FRIENDS.PROGRESS) {
      return Promise.resolve(response([]));
    }
    if (url === API_ROUTES.FRIENDS.REQUESTS && init?.method === 'POST') {
      sent = true;
      return Promise.resolve(response({ friendship_id: linkId }, 201));
    }
    if (url === API_ROUTES.FRIENDS.REQUESTS) {
      return Promise.resolve(
        response(
          sent
            ? [
                {
                  id: linkId,
                  user: { id: friendId, username: 'test_person_2' },
                  requested_at: iso(0),
                  accepted_at: null,
                  is_incoming: false,
                },
              ]
            : [],
        ),
      );
    }
    if (url === `${API_ROUTES.FRIENDS.SEARCH}?username=test_person_2`) {
      return Promise.resolve(response([{ id: friendId, username: 'test_person_2' }]));
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
  renderWithProviders(<FriendsPage />);
  fireEvent.press(screen.getByRole('tab', { name: 'Add Friends' }));
  const input = await screen.findByLabelText('Search users');
  fireEvent.changeText(input, 'test_person_2');
  const result = await screen.findByLabelText('Search result for test_person_2');
  fireEvent.press(within(result).getByRole('button', { name: 'Add test_person_2' }));
  expect(await within(result).findByText('Sent')).toBeTruthy();
});

test('shows search loading, error, retry, and empty states', async () => {
  let resolveSearch: ((value: Response) => void) | undefined;
  let searchReads = 0;
  const firstSearch = new Promise<Response>((resolve) => {
    resolveSearch = resolve;
  });
  mockFetch.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (
      url === API_ROUTES.FRIENDS.BASE ||
      url === API_ROUTES.FRIENDS.PROGRESS ||
      url === API_ROUTES.FRIENDS.REQUESTS
    ) {
      return Promise.resolve(response([]));
    }
    if (url === `${API_ROUTES.FRIENDS.SEARCH}?username=missing_person`) {
      searchReads += 1;
      return searchReads === 1 ? firstSearch : Promise.resolve(response([]));
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
  renderWithProviders(<FriendsPage />);
  fireEvent.press(screen.getByRole('tab', { name: 'Add Friends' }));
  const input = await screen.findByLabelText('Search users');
  fireEvent.changeText(input, 'missing_person');
  expect(screen.getByLabelText('Search loading')).toBeTruthy();
  await act(async () => {
    resolveSearch?.(response({}, 503));
  });
  expect(await screen.findByLabelText('Search error state')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Retry search' }));
  expect(await screen.findByLabelText('Search empty state')).toBeTruthy();
});
