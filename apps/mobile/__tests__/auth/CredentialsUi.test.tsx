/// <reference types="jest" />

import { LandingScreen } from '@/auth/components/LandingScreen';
import { LoginForm } from '@/auth/components/LoginForm';
import { RegisterForm } from '@/auth/components/RegisterForm';
import { API_ROUTES } from '@/config/env';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '../../test-utils/renderWithProviders';

const mockNavigate = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockFetch = jest.fn();
const mockStartGoogleSso = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    navigate: mockNavigate,
    replace: mockReplace,
    back: mockBack,
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

beforeEach(() => {
  mockNavigate.mockReset();
  mockReplace.mockReset();
  mockBack.mockReset();
  mockFetch.mockReset();
  mockStartGoogleSso.mockReset();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

test('landing screen shows credentials actions without oauth options', () => {
  renderWithProviders(<LandingScreen />);
  expect(screen.getByText('Procradicator')).toBeTruthy();
  expect(screen.getByText('Register')).toBeTruthy();
  expect(screen.getByText('Login')).toBeTruthy();
  expect(screen.queryByText(/oauth/i)).toBeNull();
});

test('login form sends username and password as form data', async () => {
  mockFetch.mockResolvedValueOnce({ ok: true } as Response);
  renderWithProviders(<LoginForm />);
  fireEvent.changeText(screen.getByPlaceholderText('Username'), 'testuser');
  fireEvent.changeText(screen.getByPlaceholderText('Password'), 'correct-password');
  fireEvent.press(screen.getByLabelText('Submit login'));
  await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
  const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
  const body = options.body as URLSearchParams;
  expect(url).toBe(API_ROUTES.AUTH.LOGIN);
  expect(options.method).toBe('POST');
  expect(options.credentials).toBe('include');
  expect(options.headers).toEqual({ 'Content-Type': 'application/x-www-form-urlencoded' });
  expect(body.toString()).toBe('username=testuser&password=correct-password');
  expect(mockReplace).toHaveBeenCalledWith('/tasks');
});

test('login form shows required validation messages', async () => {
  renderWithProviders(<LoginForm />);
  fireEvent.changeText(screen.getByPlaceholderText('Username'), '   ');
  fireEvent.press(screen.getByLabelText('Submit login'));
  expect(await screen.findByText('Username is required.')).toBeTruthy();
  expect(screen.getByText('Password is required.')).toBeTruthy();
  expect(mockFetch).not.toHaveBeenCalled();
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
