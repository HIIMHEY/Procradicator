/// <reference types="jest" />

jest.mock('../../src/global.css', () => ({}));

jest.mock('react-native-gesture-handler', () => {
  const { View } = jest.requireActual('react-native') as typeof import('react-native');
  return {
    GestureHandlerRootView: View,
  };
});

import RootLayout from '@/app/_layout';
import { screen } from '@testing-library/react-native';
import { renderWithProviders } from '../../test-utils/renderWithProviders';

const mockUseCurrentUser = jest.fn();

jest.mock('@/auth/hooks/useCurrentUser', () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));

jest.mock('expo-router', () => ({
  Stack: () => null,
}));

beforeEach(() => {
  mockUseCurrentUser.mockReset();
});

test('shows auth loading state while login status is still being checked', () => {
  mockUseCurrentUser.mockReturnValue({
    data: undefined,
    isPending: true,
    isLoading: true,
  });
  renderWithProviders(<RootLayout />);
  expect(screen.getByLabelText('Checking your session')).toBeTruthy();
  expect(screen.getByText('Checking your session...')).toBeTruthy();
});
