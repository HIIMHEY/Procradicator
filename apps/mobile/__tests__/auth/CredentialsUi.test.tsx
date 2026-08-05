/// <reference types="jest" />

import 'fake-indexeddb/auto';

import { LandingScreen } from '@/auth/components/LandingScreen';
import { LoginForm } from '@/auth/components/LoginForm';
import { RegisterForm } from '@/auth/components/RegisterForm';
import { createAuthSession, createLogoutSession } from '@/auth/offlineSession';
import { loadCurrentUser } from '@/auth/sessionManager';
import { API_ROUTES } from '@/config/env';
import { deleteOfflineDatabase, saveAuthAndEnqueue } from '@/offline/database';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '../../test-utils/renderWithProviders';

const mockNavigate = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockCanGoBack = jest.fn();
const mockFetch = jest.fn();
const mockStartGoogleSso = jest.fn();

const currentSession = {
  id: '7cf2a63f-45da-4af7-9917-306abc624759',
  email: 'tom@example.com',
  username: 'tom',
  is_active: true,
  is_superuser: false,
  is_verified: false,
  server_time: '2026-07-27T09:00:00.000Z',
  session_expires_at: '2026-07-27T10:00:00.000Z',
};

const response = (body: unknown = {}, status = 200): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

jest.mock('expo-router', () => ({
  useRouter: () => ({
    navigate: mockNavigate,
    replace: mockReplace,
    back: mockBack,
    canGoBack: mockCanGoBack,
  }),
}));

jest.mock(
  '@/auth/hooks/useGoogleSso',
  () => ({
    useGoogleSso: () => ({
      mutate: mockStartGoogleSso,
      mutateAsync: mockStartGoogleSso,
      isPending: false,
    }),
  }),
  { virtual: true },
);

beforeEach(async () => {
  mockNavigate.mockReset();
  mockReplace.mockReset();
  mockBack.mockReset();
  mockCanGoBack.mockReset();
  mockFetch.mockReset();
  mockStartGoogleSso.mockReset();
  mockCanGoBack.mockReturnValue(true);
  globalThis.fetch = mockFetch as unknown as typeof fetch;
  Object.defineProperty(globalThis.navigator, 'onLine', {
    configurable: true,
    value: true,
  });
  await deleteOfflineDatabase();
});

afterAll(async () => {
  await deleteOfflineDatabase();
});

test('landing screen shows credentials actions without oauth options', () => {
  renderWithProviders(<LandingScreen />);
  expect(screen.getByText('Procradicator')).toBeTruthy();
  expect(screen.getByText('Register')).toBeTruthy();
  expect(screen.getByText('Login')).toBeTruthy();
  expect(screen.queryByText(/oauth/i)).toBeNull();
});

test('login form sends username and password as form data', async () => {
  mockFetch.mockResolvedValueOnce(response()).mockResolvedValueOnce(response(currentSession));
  renderWithProviders(<LoginForm />);
  fireEvent.changeText(screen.getByPlaceholderText('Username'), 'testuser');
  fireEvent.changeText(screen.getByPlaceholderText('Password'), 'correct-password');
  fireEvent.press(screen.getByLabelText('Submit login'));
  await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
  const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
  const body = options.body as URLSearchParams;
  expect(url).toBe(API_ROUTES.AUTH.LOGIN);
  expect(options.method).toBe('POST');
  expect(options.credentials).toBe('include');
  expect(options.headers).toEqual({ 'Content-Type': 'application/x-www-form-urlencoded' });
  expect(body.toString()).toBe('username=testuser&password=correct-password');
  expect(mockFetch).toHaveBeenLastCalledWith(API_ROUTES.AUTH.ME, {
    method: 'GET',
    credentials: 'include',
  });
  Object.defineProperty(globalThis.navigator, 'onLine', { configurable: true, value: false });
  await expect(loadCurrentUser()).resolves.toMatchObject({ id: currentSession.id });
});

test('login flushes an offline logout before replacing its tombstone', async () => {
  const authenticated = createAuthSession('http://localhost:8000', currentSession, Date.now());
  const logout = createLogoutSession(
    authenticated,
    Date.now(),
    '8d125649-03c4-4adf-b609-847a431713dd',
  );
  await saveAuthAndEnqueue(logout.record, logout.operation);
  mockFetch.mockImplementation((url: string) => {
    if (url === API_ROUTES.AUTH.LOGOUT) return Promise.resolve(response({}, 204));
    if (url === API_ROUTES.AUTH.LOGIN) return Promise.resolve(response({}, 204));
    if (url === API_ROUTES.AUTH.ME) return Promise.resolve(response(currentSession));
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });

  renderWithProviders(<LoginForm />);
  fireEvent.changeText(screen.getByPlaceholderText('Username'), 'testuser');
  fireEvent.changeText(screen.getByPlaceholderText('Password'), 'correct-password');
  fireEvent.press(screen.getByLabelText('Submit login'));

  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/tasks'));
  expect(mockFetch.mock.calls.map(([url]) => url)).toEqual([
    API_ROUTES.AUTH.LOGOUT,
    API_ROUTES.AUTH.LOGIN,
    API_ROUTES.AUTH.ME,
  ]);
  Object.defineProperty(globalThis.navigator, 'onLine', { configurable: true, value: false });
  await expect(loadCurrentUser()).resolves.toMatchObject({ id: currentSession.id });
});

test('login form shows required validation messages', async () => {
  renderWithProviders(<LoginForm />);
  fireEvent.changeText(screen.getByPlaceholderText('Username'), '   ');
  fireEvent.press(screen.getByLabelText('Submit login'));
  expect(await screen.findByText('Username is required.')).toBeTruthy();
  expect(screen.getByText('Password is required.')).toBeTruthy();
  expect(mockFetch).not.toHaveBeenCalled();
});

test('auth back button returns to landing when there is no route history', () => {
  mockCanGoBack.mockReturnValue(false);
  renderWithProviders(<LoginForm />);
  fireEvent.press(screen.getByLabelText('Go back'));
  expect(mockBack).not.toHaveBeenCalled();
  expect(mockReplace).toHaveBeenCalledWith('/');
});

test('auth back button uses route history when available', () => {
  renderWithProviders(<LoginForm />);
  fireEvent.press(screen.getByLabelText('Go back'));
  expect(mockBack).toHaveBeenCalledTimes(1);
  expect(mockReplace).not.toHaveBeenCalled();
});

test('login form rejects credentials above backend length limits', async () => {
  renderWithProviders(<LoginForm />);
  fireEvent.changeText(screen.getByPlaceholderText('Username'), 'a'.repeat(101));
  fireEvent.changeText(screen.getByPlaceholderText('Password'), 'a'.repeat(129));
  fireEvent.press(screen.getByLabelText('Submit login'));
  expect(await screen.findByText('Username must be at most 100 characters.')).toBeTruthy();
  expect(screen.getByText('Password must be at most 128 characters.')).toBeTruthy();
  expect(mockFetch).not.toHaveBeenCalled();
});

test('register form sends email username and password as json', async () => {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      id: 'user-1',
      email: 'tom@example.com',
      username: 'Tom',
      is_active: true,
      is_superuser: false,
      is_verified: false,
    }),
  } as Response);
  renderWithProviders(<RegisterForm />);
  fireEvent.changeText(screen.getByPlaceholderText('Email'), 'tom@example.com');
  fireEvent.changeText(screen.getByPlaceholderText('Username'), 'Tom');
  fireEvent.changeText(screen.getByPlaceholderText('Password'), 'password123');
  fireEvent.press(screen.getByLabelText('Submit registration'));
  await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
  const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
  expect(url).toBe(API_ROUTES.AUTH.REGISTER);
  expect(options.method).toBe('POST');
  expect(options.credentials).toBe('include');
  expect(options.headers).toEqual({ 'Content-Type': 'application/json' });
  expect(JSON.parse(String(options.body))).toEqual({
    email: 'tom@example.com',
    username: 'Tom',
    password: 'password123',
  });
  expect(mockReplace).toHaveBeenCalledWith('/login');
});

test('register form shows validation messages for invalid input', async () => {
  renderWithProviders(<RegisterForm />);
  fireEvent.changeText(screen.getByPlaceholderText('Email'), 'not-an-email');
  fireEvent.changeText(screen.getByPlaceholderText('Username'), '   ');
  fireEvent.changeText(screen.getByPlaceholderText('Password'), 'short');
  fireEvent.press(screen.getByLabelText('Submit registration'));
  expect(await screen.findByText('Enter a valid email.')).toBeTruthy();
  expect(screen.getByText('Username is required.')).toBeTruthy();
  expect(screen.getByText('Password must be at least 8 characters.')).toBeTruthy();
  expect(mockFetch).not.toHaveBeenCalled();
});

test('register form rejects credentials above backend length limits', async () => {
  renderWithProviders(<RegisterForm />);
  fireEvent.changeText(screen.getByPlaceholderText('Email'), 'tom@example.com');
  fireEvent.changeText(screen.getByPlaceholderText('Username'), 'a'.repeat(101));
  fireEvent.changeText(screen.getByPlaceholderText('Password'), 'a'.repeat(129));
  fireEvent.press(screen.getByLabelText('Submit registration'));
  expect(await screen.findByText('Username must be at most 100 characters.')).toBeTruthy();
  expect(screen.getByText('Password must be at most 128 characters.')).toBeTruthy();
  expect(mockFetch).not.toHaveBeenCalled();
});

test('login form shows Google SSO button', () => {
  renderWithProviders(<LoginForm />);
  expect(screen.getByText('Continue with Google')).toBeTruthy();
});

test('register form shows Google SSO button', () => {
  renderWithProviders(<RegisterForm />);
  expect(screen.getByText('Continue with Google')).toBeTruthy();
});

test('pressing Google SSO button starts the SSO flow', async () => {
  renderWithProviders(<LoginForm />);
  fireEvent.press(screen.getByLabelText('Continue with Google'));
  await waitFor(() => expect(mockStartGoogleSso).toHaveBeenCalledTimes(1));
});
