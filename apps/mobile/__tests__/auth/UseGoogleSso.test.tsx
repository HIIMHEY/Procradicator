/// <reference types="jest" />

import SsoCallback from '@/app/auth/sso/callback';
import { useGoogleSso } from '@/auth/hooks/useGoogleSso';
import { API_ROUTES } from '@/config/env';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { renderWithProviders } from '../../test-utils/renderWithProviders';

const mockReplace = jest.fn();
const mockFetch = jest.fn();
const mockSearchParams: Record<string, string | undefined> = {};

type Deferred<T> = {
  promise: Promise<T>;
  reject: (reason?: unknown) => void;
  resolve: (value: T) => void;
};

const createDeferred = <T,>(): Deferred<T> => {
  let resolve: Deferred<T>['resolve'];
  let reject: Deferred<T>['reject'];
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return {
    promise,
    reject: reject!,
    resolve: resolve!,
  };
};

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockSearchParams,
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

function GoogleSsoProbe() {
  const googleSso = useGoogleSso();
  return (
    <>
      <Pressable
        accessibilityLabel="Start Google SSO"
        onPress={() => {
          googleSso.mutate();
        }}
      >
        <Text>Start Google</Text>
      </Pressable>
      {googleSso.error instanceof Error ? <Text>{googleSso.error.message}</Text> : null}
    </>
  );
}

beforeEach(() => {
  mockReplace.mockReset();
  mockFetch.mockReset();
  for (const key of Object.keys(mockSearchParams)) {
    delete mockSearchParams[key];
  }
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
  Object.defineProperty(window, 'opener', {
    configurable: true,
    value: null,
  });
  Object.defineProperty(window, 'close', {
    configurable: true,
    value: jest.fn(),
  });
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

test('Google SSO opens a blank popup immediately then navigates it after authorize returns', async () => {
  let messageHandler: ((event: MessageEvent) => void) | undefined;
  const authorizeResponse = createDeferred<Response>();
  const popup = {
    close: jest.fn(),
    closed: false,
    location: { href: '' },
  } as unknown as Window;
  const openSpy = jest.spyOn(window, 'open').mockReturnValueOnce(popup);
  const addSpy = jest
    .spyOn(window, 'addEventListener')
    .mockImplementation((eventName, listener) => {
      if (eventName === 'message') {
        messageHandler = listener as (event: MessageEvent) => void;
      }
    });
  const removeSpy = jest.spyOn(window, 'removeEventListener');
  const callbackUrl = `${window.location.origin}/auth/sso/callback`;
  mockFetch.mockReturnValueOnce(authorizeResponse.promise).mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      id: 'user-1',
      email: 'tom@example.com',
      username: 'tom',
      is_active: true,
      is_superuser: false,
      is_verified: false,
    }),
  } as Response);
  renderWithProviders(<GoogleSsoProbe />);
  fireEvent.press(screen.getByLabelText('Start Google SSO'));
  await waitFor(() =>
    expect(openSpy).toHaveBeenCalledWith('', 'procradicator-google-sso', 'width=500,height=700'),
  );
  expect(popup.location.href).toBe('');
  authorizeResponse.resolve({
    ok: true,
    json: async () => ({ authorization_url: 'https://accounts.google.com/oauth' }),
  } as Response);
  await waitFor(() => expect(popup.location.href).toBe('https://accounts.google.com/oauth'));
  expect(addSpy).toHaveBeenCalledWith('message', expect.any(Function));
  expect(messageHandler).toBeDefined();
  const [authorizeUrl, authorizeOptions] = mockFetch.mock.calls[0] as [string, RequestInit];
  const parsedAuthorizeUrl = new URL(authorizeUrl);
  expect(`${parsedAuthorizeUrl.origin}${parsedAuthorizeUrl.pathname}`).toBe(
    API_ROUTES.AUTH.GOOGLE_AUTHORIZE,
  );
  expect(parsedAuthorizeUrl.searchParams.get('redirect_uri')).toBe(callbackUrl);
  expect(authorizeOptions.credentials).toBe('include');
  messageHandler?.({
    origin: window.location.origin,
    source: popup,
    data: {
      type: 'procradicator:sso-complete',
      provider: 'google',
      status: 'success',
    },
  } as MessageEvent);
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/tasks'));
  expect(mockFetch).toHaveBeenLastCalledWith(API_ROUTES.AUTH.ME, {
    method: 'GET',
    credentials: 'include',
  });
  expect(mockFetch).toHaveBeenCalledTimes(2);
  expect(removeSpy).toHaveBeenCalledWith('message', expect.any(Function));
  openSpy.mockRestore();
  addSpy.mockRestore();
  removeSpy.mockRestore();
});

test('Google SSO closes the blank popup when the authorize request fails', async () => {
  const popup = {
    close: jest.fn(),
    closed: false,
    location: { href: '' },
  } as unknown as Window;
  const openSpy = jest.spyOn(window, 'open').mockReturnValueOnce(popup);
  mockFetch.mockResolvedValueOnce({ ok: false } as Response);
  renderWithProviders(<GoogleSsoProbe />);
  fireEvent.press(screen.getByLabelText('Start Google SSO'));
  await waitFor(() => expect(screen.getByText('Could not start Google login.')).toBeTruthy());
  expect(openSpy).toHaveBeenCalledWith('', 'procradicator-google-sso', 'width=500,height=700');
  expect(popup.close).toHaveBeenCalledTimes(1);
  expect(mockFetch).toHaveBeenCalledTimes(1);
  openSpy.mockRestore();
});

test('SSO callback calls backend callback and posts success without tokens', async () => {
  const postMessage = jest.fn();
  const close = jest.fn();
  Object.defineProperty(window, 'opener', {
    configurable: true,
    value: { postMessage },
  });
  Object.defineProperty(window, 'close', {
    configurable: true,
    value: close,
  });
  mockSearchParams.code = 'google-code';
  mockSearchParams.state = 'oauth-state';
  mockFetch.mockResolvedValueOnce({ ok: true } as Response);
  renderWithProviders(<SsoCallback />);
  await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
  const [callbackUrl, callbackOptions] = mockFetch.mock.calls[0] as [string, RequestInit];
  const parsedCallbackUrl = new URL(callbackUrl);
  expect(`${parsedCallbackUrl.origin}${parsedCallbackUrl.pathname}`).toBe(
    API_ROUTES.AUTH.GOOGLE_CALLBACK,
  );
  expect(parsedCallbackUrl.searchParams.get('code')).toBe('google-code');
  expect(parsedCallbackUrl.searchParams.get('state')).toBe('oauth-state');
  expect(parsedCallbackUrl.searchParams.get('redirect_uri')).toBe(
    `${window.location.origin}/auth/sso/callback`,
  );
  expect(callbackOptions.credentials).toBe('include');
  expect(postMessage).toHaveBeenCalledWith(
    {
      type: 'procradicator:sso-complete',
      provider: 'google',
      status: 'success',
    },
    window.location.origin,
  );
  expect(JSON.stringify(postMessage.mock.calls[0][0])).not.toMatch(/token/i);
});
