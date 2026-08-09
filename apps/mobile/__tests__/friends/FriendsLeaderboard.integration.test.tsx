import { friendId, linkId, response, stubFriendsFetch } from '../../test-utils/friendTestUtils';
import { iso, uid } from '../../test-utils/factories';
import { API_ROUTES } from '@/config/env';
import { FriendsPage } from '@/friends/components/FriendsPage';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { renderWithProviders } from '../../test-utils/renderWithProviders';

const mockFetch = jest.fn();

beforeEach(() => {
  mockFetch.mockReset();
  stubFriendsFetch(mockFetch);
});

test("shows each friend's current-day statistics", async () => {
  mockFetch.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url === API_ROUTES.FRIENDS.BASE) {
      return Promise.resolve(
        response([
          {
            id: linkId,
            user: { id: friendId, username: 'test_person_1' },
            requested_at: iso(0),
            accepted_at: iso(5),
            is_incoming: false,
          },
        ]),
      );
    }
    if (url === API_ROUTES.FRIENDS.PROGRESS) {
      return Promise.resolve(
        response([
          {
            user: { id: friendId, username: 'test_person_1' },
            focus_min: 45,
            completed_subtasks: 3,
          },
        ]),
      );
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
  renderWithProviders(<FriendsPage />);
  const card = await screen.findByLabelText('Friend progress for test_person_1');
  expect(within(card).getByText('45 min')).toBeTruthy();
  expect(within(card).getByText('3 subtasks')).toBeTruthy();
});

test('nudges a friend from the leaderboard', async () => {
  mockFetch.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === API_ROUTES.FRIENDS.BASE) {
      return Promise.resolve(
        response([
          {
            id: linkId,
            user: { id: friendId, username: 'test_person_1' },
            requested_at: iso(0),
            accepted_at: iso(5),
            is_incoming: false,
          },
        ]),
      );
    }
    if (url === API_ROUTES.FRIENDS.PROGRESS) {
      return Promise.resolve(
        response([
          {
            user: { id: friendId, username: 'test_person_1' },
            focus_min: 45,
            completed_subtasks: 3,
          },
        ]),
      );
    }
    if (url === API_ROUTES.FRIENDS.NUDGE(linkId) && init?.method === 'POST') {
      return Promise.resolve(response({ nudge_id: uid('nudge') }, 201));
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
  renderWithProviders(<FriendsPage />);
  fireEvent.press(await screen.findByRole('button', { name: 'Nudge test_person_1' }));
  await waitFor(() => {
    expect(mockFetch).toHaveBeenCalledWith(
      API_ROUTES.FRIENDS.NUDGE(linkId),
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

test('removes a friend from the leaderboard', async () => {
  let removed = false;
  mockFetch.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === API_ROUTES.FRIENDS.DETAIL(linkId) && init?.method === 'DELETE') {
      removed = true;
      return Promise.resolve(response(null, 204));
    }
    if (url === API_ROUTES.FRIENDS.BASE) {
      return Promise.resolve(
        response(
          removed
            ? []
            : [
                {
                  id: linkId,
                  user: { id: friendId, username: 'test_person_1' },
                  requested_at: iso(0),
                  accepted_at: iso(5),
                  is_incoming: false,
                },
              ],
        ),
      );
    }
    if (url === API_ROUTES.FRIENDS.PROGRESS) {
      return Promise.resolve(
        response(
          removed
            ? []
            : [
                {
                  user: { id: friendId, username: 'test_person_1' },
                  focus_min: 45,
                  completed_subtasks: 3,
                },
              ],
        ),
      );
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
  renderWithProviders(<FriendsPage />);
  await screen.findByLabelText('Friend progress for test_person_1');
  fireEvent.press(screen.getByLabelText('More actions for test_person_1'));
  fireEvent.press(screen.getByRole('button', { name: 'Remove test_person_1' }));
  expect(await screen.findByLabelText('Leaderboard empty state')).toBeTruthy();
  expect(screen.queryByLabelText('Friend progress for test_person_1')).toBeNull();
});

test('shows loading and empty leaderboard states', async () => {
  let resolveFriends: ((value: Response) => void) | undefined;
  let resolveProgress: ((value: Response) => void) | undefined;
  const friends = new Promise<Response>((resolve) => {
    resolveFriends = resolve;
  });
  const progress = new Promise<Response>((resolve) => {
    resolveProgress = resolve;
  });
  mockFetch.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url === API_ROUTES.FRIENDS.BASE) return friends;
    if (url === API_ROUTES.FRIENDS.PROGRESS) return progress;
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
  renderWithProviders(<FriendsPage />);
  expect(screen.getByLabelText('Leaderboard loading')).toBeTruthy();
  await act(async () => {
    resolveFriends?.(response([]));
    resolveProgress?.(response([]));
  });
  expect(await screen.findByLabelText('Leaderboard empty state')).toBeTruthy();
});
