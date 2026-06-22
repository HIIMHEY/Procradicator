/// <reference types="jest" />

import { useGoogleSso } from '@/auth/hooks/useGoogleSso';
import { API_ROUTES } from '@/config/env';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, Text } from 'react-native';
import { renderWithProviders } from '../../test-utils/renderWithProviders';

const mockReplace = jest.fn();
const mockFetch = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(),
  dismissAuthSession: jest.fn(),
  WebBrowserResultType: {
    CANCEL: 'cancel',
  },
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
  jest.mocked(WebBrowser.openAuthSessionAsync).mockReset();
  jest.mocked(WebBrowser.dismissAuthSession).mockReset();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

test('Google SSO navigates after the backend confirms the user', async () => {
  mockFetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ authorization_url: 'https://accounts.google.com/oauth' }),
    } as Response)
    .mockResolvedValueOnce({
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
  jest
    .mocked(WebBrowser.openAuthSessionAsync)
    .mockReturnValueOnce(new Promise(() => undefined));
  renderWithProviders(<GoogleSsoProbe />);
  fireEvent.press(screen.getByLabelText('Start Google SSO'));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/tasks'));
  expect(WebBrowser.dismissAuthSession).toHaveBeenCalledTimes(1);
  expect(mockFetch).toHaveBeenCalledTimes(2);
  expect(mockFetch).toHaveBeenLastCalledWith(API_ROUTES.AUTH.ME, {
    method: 'GET',
    credentials: 'include',
  });
});

test('Google SSO does not navigate if the popup closes before login is confirmed', async () => {
  mockFetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ authorization_url: 'https://accounts.google.com/oauth' }),
    } as Response)
    .mockResolvedValue({
      ok: false,
      status: 401,
    } as Response);
  jest.mocked(WebBrowser.openAuthSessionAsync).mockResolvedValueOnce({
    type: WebBrowser.WebBrowserResultType.CANCEL,
  });
  renderWithProviders(<GoogleSsoProbe />);
  fireEvent.press(screen.getByLabelText('Start Google SSO'));
  expect(await screen.findByText('Google login was cancelled or did not complete.')).toBeTruthy();
  expect(mockReplace).not.toHaveBeenCalled();
});
