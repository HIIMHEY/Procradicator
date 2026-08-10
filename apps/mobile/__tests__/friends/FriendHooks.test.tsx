import { Text } from '@/components/ui/text';
import { API_ROUTES } from '@/config/env';
import { useAcceptFriendRequest, useSendFriendRequest } from '@/friends/hooks/useFriendActions';
import { useFriendProgress } from '@/friends/hooks/useFriendQueries';
import { onlineManager } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Pressable } from 'react-native';
import { linkId, response, userId } from '../../test-utils/friendTestUtils';
import { uid } from '../../test-utils/factories';
import { renderWithProviders } from '../../test-utils/renderWithProviders';

const mockFetch = jest.fn();

function ProgressProbe() {
  const { data, fetchStatus, isError } = useFriendProgress(userId);
  if (isError) return <Text>Error</Text>;
  return <Text>{data?.[0]?.focus_min ?? fetchStatus}</Text>;
}

function AcceptProbe() {
  const accept = useAcceptFriendRequest();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Accept"
      onPress={() => accept.mutate(linkId)}
    >
      <Text>Accept</Text>
    </Pressable>
  );
}

function SendProbe() {
  const request = useSendFriendRequest();
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Send"
        onPress={() => request.mutate('test_person_1')}
      >
        <Text>Send</Text>
      </Pressable>
      <Text>{request.data?.friendship_id}</Text>
    </>
  );
}

beforeEach(() => {
  onlineManager.setOnline(true);
  mockFetch.mockReset();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

afterEach(() => {
  onlineManager.setOnline(true);
});

test('loads friend progress through an online-only query', async () => {
  mockFetch.mockResolvedValueOnce(
    response([
      {
        user: { id: userId, username: 'test_person_1' },
        focus_min: 45,
        completed_subtasks: 2,
      },
    ]),
  );
  renderWithProviders(<ProgressProbe />);
  expect(await screen.findByText('45')).toBeTruthy();
});

test('does not request friend progress while offline', async () => {
  onlineManager.setOnline(false);
  renderWithProviders(<ProgressProbe />);
  expect(await screen.findByText('paused')).toBeTruthy();
  expect(mockFetch).not.toHaveBeenCalled();
});

test('exposes malformed friend progress to the caller', async () => {
  mockFetch.mockResolvedValueOnce(
    response([
      {
        user: { id: userId, username: 'test_person_1' },
        focus_min: -1,
        completed_subtasks: 0,
      },
    ]),
  );
  renderWithProviders(<ProgressProbe />);
  expect(await screen.findByText('Error')).toBeTruthy();
});

test('accepts a friend request through the API', async () => {
  mockFetch.mockResolvedValueOnce(response(null, 204));
  renderWithProviders(<AcceptProbe />);
  fireEvent.press(screen.getByRole('button', { name: 'Accept' }));
  await waitFor(() => {
    expect(mockFetch).toHaveBeenCalledWith(`${API_ROUTES.FRIENDS.REQUESTS}/${linkId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': '1',
      },
      body: JSON.stringify({ status: 'accepted' }),
      credentials: 'include',
    });
  });
});

test('returns the new friendship after sending a request', async () => {
  const id = uid('friendship');
  mockFetch.mockResolvedValueOnce(response({ friendship_id: id }));
  renderWithProviders(<SendProbe />);
  fireEvent.press(screen.getByRole('button', { name: 'Send' }));
  expect(await screen.findByText(id)).toBeTruthy();
});
