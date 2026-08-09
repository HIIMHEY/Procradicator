/// <reference types="jest" />

jest.mock('../../src/global.css', () => ({}));

jest.mock('react-native-gesture-handler', () => {
  const { View } = jest.requireActual('react-native') as typeof import('react-native');
  return { GestureHandlerRootView: View };
});

import IndexRoute from '@/app/index';
import RootLayout from '@/app/_layout';
import TaskRoute from '@/app/tasks';
import { LoginForm } from '@/auth/components/LoginForm';
import { RegisterForm } from '@/auth/components/RegisterForm';
import { API_ROUTES } from '@/config/env';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

const mockFetch = jest.fn();

const user = {
  id: '7cf2a63f-45da-4af7-9917-306abc624759',
  email: 'user@example.com',
  username: 'user',
  is_active: true,
  is_superuser: false,
  is_verified: false,
  server_time: '2026-07-27T09:00:00.000Z',
  session_expires_at: '2026-07-27T10:00:00.000Z',
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
  index: { default: IndexRoute },
  login: { default: LoginForm },
  register: { default: RegisterForm },
  'auth/sso/callback': { default: EmptyRoute },
  'analytics/index': { default: EmptyRoute },
  'friends/index': { default: EmptyRoute },
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
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { origin: 'http://localhost:8081' },
  });
  Object.defineProperty(window, 'open', {
    configurable: true,
    value: jest.fn(),
  });
  Object.defineProperty(window, 'addEventListener', {
    configurable: true,
    value: jest.fn(),
  });
  Object.defineProperty(window, 'removeEventListener', {
    configurable: true,
    value: jest.fn(),
  });
});

test('SSO logout allows immediate login and registration', async () => {
  let authChecks = 0;
  let messageHandler: ((event: MessageEvent) => void) | undefined;
  const popup = {
    close: jest.fn(),
    closed: false,
    location: { href: '' },
  } as unknown as Window;
  jest.spyOn(window, 'open').mockReturnValueOnce(popup);
  jest.spyOn(window, 'addEventListener').mockImplementation((eventName, listener) => {
    if (eventName === 'message') {
      messageHandler = listener as (event: MessageEvent) => void;
    }
  });
  mockFetch.mockImplementation((url: string) => {
    if (url === API_ROUTES.AUTH.ME) {
      authChecks += 1;
      return Promise.resolve(authChecks === 1 ? response({}, 401) : response(user));
    }
    if (url.startsWith(API_ROUTES.AUTH.GOOGLE_AUTHORIZE)) {
      return Promise.resolve(response({ authorization_url: 'https://accounts.google.com/oauth' }));
    }
    if (url === API_ROUTES.AUTH.LOGOUT) {
      return Promise.resolve(response({}));
    }
    return new Promise<Response>(() => undefined);
  });
  const view = renderRouter(routes, { initialUrl: '/login' });
  expect(await screen.findByLabelText('Continue with Google')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Continue with Google'));
  await waitFor(() => expect(popup.location.href).toBe('https://accounts.google.com/oauth'));
  await act(async () => {
    messageHandler?.({
      origin: window.location.origin,
      source: popup,
      data: {
        type: 'procradicator:sso-complete',
        provider: 'google',
        status: 'success',
      },
    } as MessageEvent);
  });
  expect(await screen.findByText('Your Tasks')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Open navigation'));
  fireEvent.press(screen.getByRole('button', { name: 'Log out' }));
  await waitFor(() => expect(view.getPathname()).toBe('/'));
  fireEvent.press(screen.getByLabelText('Get Started'));
  await waitFor(() => expect(view.getPathname()).toBe('/register'));
  fireEvent.press(screen.getByLabelText('Go back'));
  await waitFor(() => expect(view.getPathname()).toBe('/'));
  fireEvent.press(screen.getByLabelText('Sign In'));
  await waitFor(() => expect(view.getPathname()).toBe('/login'));
});
