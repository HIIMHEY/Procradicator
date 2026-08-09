import { useCurrentUser } from '@/auth/hooks/useCurrentUser';

export const mockReplace = jest.fn();

jest.mock('@/auth/hooks/useCurrentUser');
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

export const mockUseCurrentUser = jest.mocked(useCurrentUser);

export function stubCurrentUser(userId = 'user-1') {
  mockReplace.mockReset();
  mockUseCurrentUser.mockReset();
  mockUseCurrentUser.mockReturnValue({ data: { id: userId } } as never);
}
