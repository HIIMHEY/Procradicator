import { useCurrentUser } from '@/auth/hooks/useCurrentUser';
import { uid } from './factories';

export { response } from './http';

export const userId = uid('user');
export const friendId = uid('friend');
export const linkId = uid('link');

export const mockReplace = jest.fn();

jest.mock('@/auth/hooks/useCurrentUser');
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

export const mockUseCurrentUser = jest.mocked(useCurrentUser);

export function stubFriendsFetch(mockFetch: jest.Mock) {
  mockReplace.mockReset();
  mockUseCurrentUser.mockReset();
  mockUseCurrentUser.mockReturnValue({ data: { id: userId } } as never);
  globalThis.fetch = mockFetch as unknown as typeof fetch;
}
