/// <reference types="jest" />

jest.mock('../../src/global.css', () => ({}));

jest.mock('react-native-gesture-handler', () => {
  const { View } = jest.requireActual('react-native') as typeof import('react-native');
  return {
    GestureHandlerRootView: View,
  };
});

import AnalyticsRoute from '@/app/analytics';
import RootLayout from '@/app/_layout';
import TaskRoute from '@/app/tasks';
import { LandingScreen } from '@/auth/components/LandingScreen';
import { LoginForm } from '@/auth/components/LoginForm';
import { API_ROUTES } from '@/config/env';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

const mockFetch = jest.fn();

const user = {
  id: '7cf2a63f-45da-4af7-9917-306abc624759',
  email: 'tom@example.com',
  username: 'tom',
  is_active: true,
  is_superuser: false,
  is_verified: false,
};

const response = (body: unknown, status = 200): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

function EmptyRoute() {
  return null;
}

const routes = {
  _layout: { default: RootLayout },
  index: { default: LandingScreen },
  login: { default: LoginForm },
  register: { default: EmptyRoute },
  'auth/sso/callback': { default: EmptyRoute },
  'analytics/index': { default: AnalyticsRoute },
  'tasks/index': { default: TaskRoute },
  'tasks/create': { default: EmptyRoute },
  'tasks/create/chat': { default: EmptyRoute },
  'tasks/[id]': { default: EmptyRoute },
  'tasks/[id]/edit': { default: EmptyRoute },
  'tasks/[id]/edit/chat': { default: EmptyRoute },
  'focus/[id]/index': { default: EmptyRoute },
};

beforeEach(() => {
  mockFetch.mockReset();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

afterEach(() => {
  jest.useRealTimers();
});

test('successful login lands on the task dashboard', async () => {
  let authChecks = 0;
  let finishAuth: ((value: Response) => void) | undefined;
  mockFetch.mockImplementation((url: string) => {
    if (url === API_ROUTES.AUTH.ME) {
      authChecks += 1;
      if (authChecks === 1) {
        return Promise.resolve(response({}, 401));
      }
      return new Promise<Response>((resolve) => {
        finishAuth = resolve;
      });
    }
    if (url === API_ROUTES.AUTH.LOGIN) {
      return Promise.resolve(response({}));
    }
    return new Promise<Response>(() => undefined);
  });
  const view = renderRouter(routes, { initialUrl: '/login' });
  expect(await screen.findByPlaceholderText('Username')).toBeTruthy();
  fireEvent.changeText(screen.getByPlaceholderText('Username'), 'tom');
  fireEvent.changeText(screen.getByPlaceholderText('Password'), 'password123');
  fireEvent.press(screen.getByLabelText('Submit login'));
  await waitFor(() => expect(authChecks).toBe(2));
  await act(async () => {
    finishAuth?.(response(user));
  });
  await waitFor(() => {
    expect(view.getPathname()).toBe('/tasks');
    expect(screen.getByText('Your Tasks')).toBeTruthy();
    expect(screen.queryByText('Analytics')).toBeNull();
  });
});

test('existing session cannot remain on the login page', async () => {
  mockFetch.mockImplementation((url: string) => {
    if (url === API_ROUTES.AUTH.ME) {
      return Promise.resolve(response(user));
    }
    return new Promise<Response>(() => undefined);
  });
  const view = renderRouter(routes, { initialUrl: '/login' });
  await waitFor(() => {
    expect(view.getPathname()).toBe('/tasks');
    expect(screen.getByText('Your Tasks')).toBeTruthy();
  });
});

test('logged-out user cannot remain on the task dashboard', async () => {
  mockFetch.mockResolvedValue(response({}, 401));
  const view = renderRouter(routes, { initialUrl: '/tasks' });
  await waitFor(() => {
    expect(view.getPathname()).toBe('/');
    expect(screen.getByText('Procradicator')).toBeTruthy();
  });
});
