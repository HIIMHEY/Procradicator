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
import type { ReactNode } from 'react';
import { renderWithProviders } from '../../test-utils/renderWithProviders';

const mockUseCurrentUser = jest.fn();

jest.mock('@/auth/hooks/useCurrentUser', () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));

jest.mock('expo-router', () => {
  const { Text } = jest.requireActual('react-native') as typeof import('react-native');
  function Stack({ children }: { children: ReactNode }) {
    return <>{children}</>;
  }
  function StackScreen({ name }: { name: string }) {
    return <Text>{name}</Text>;
  }
  function StackProtected({ guard, children }: { guard: boolean; children: ReactNode }) {
    return guard ? <>{children}</> : null;
  }
  Stack.Screen = StackScreen;
  Stack.Protected = StackProtected;
  return { Stack };
});
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
  expect(screen.queryByText('login')).toBeNull();
  expect(screen.queryByText('tasks/index')).toBeNull();
});

test('logged-out users only get public auth routes', () => {
  mockUseCurrentUser.mockReturnValue({
    data: null,
    isPending: false,
    isLoading: false,
  });
  renderWithProviders(<RootLayout />);
  expect(screen.getByText('index')).toBeTruthy();
  expect(screen.getByText('login')).toBeTruthy();
  expect(screen.getByText('register')).toBeTruthy();
  expect(screen.getByText('auth/sso/callback')).toBeTruthy();
  expect(screen.queryByText('tasks/index')).toBeNull();
  expect(screen.queryByText('tasks/create')).toBeNull();
  expect(screen.queryByText('tasks/[id]/edit')).toBeNull();
  expect(screen.queryByText('tasks/[id]')).toBeNull();
  expect(screen.queryByText('tasks/[id]/chat')).toBeNull();
});

test('logged-in users get protected task routes', () => {
  mockUseCurrentUser.mockReturnValue({
    data: {
      id: 'user-1',
      email: 'tom@example.com',
      username: 'tom',
      is_active: true,
      is_superuser: false,
      is_verified: false,
    },
    isPending: false,
    isLoading: false,
  });
  renderWithProviders(<RootLayout />);
  expect(screen.getByText('tasks/index')).toBeTruthy();
  expect(screen.getByText('tasks/create')).toBeTruthy();
  expect(screen.getByText('tasks/[id]/edit')).toBeTruthy();
  expect(screen.getByText('tasks/[id]')).toBeTruthy();
  expect(screen.getByText('tasks/[id]/chat')).toBeTruthy();
  expect(screen.queryByText('login')).toBeNull();
  expect(screen.queryByText('register')).toBeNull();
});
