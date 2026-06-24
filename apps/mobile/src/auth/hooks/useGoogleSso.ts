import { API_ROUTES } from '@/config/env';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import type { UserRead } from '../schemas';
import { ssoCallbackMessageSchema } from '../schemas';
import { fetchCurrentUser } from './useCurrentUser';

type GoogleAuthorizeResponse = {
  authorization_url?: unknown;
};

const SSO_TIMEOUT_MS = 60_000;
const POPUP_CLOSED_CHECK_MS = 1000;
const GOOGLE_SSO_POPUP_NAME = 'procradicator-google-sso';
const GOOGLE_SSO_POPUP_FEATURES = 'width=500,height=700';

const getFrontendCallbackUrl = (): string => {
  if (typeof window === 'undefined' || !window.location?.origin) {
    throw new Error('Google login is only available on web right now.');
  }
  return `${window.location.origin}/auth/sso/callback`;
};

const buildUrlWithRedirectUri = (url: string, redirectUri: string): string => {
  const parsedUrl = new URL(url);
  parsedUrl.searchParams.set('redirect_uri', redirectUri);
  return parsedUrl.toString();
};

const readAuthorizationUrl = async (redirectUri: string): Promise<string> => {
  const response = await fetch(
    buildUrlWithRedirectUri(API_ROUTES.AUTH.GOOGLE_AUTHORIZE, redirectUri),
    {
      method: 'GET',
      credentials: 'include',
    },
  );
  if (!response.ok) {
    throw new Error('Could not start Google login.');
  }
  const data = (await response.json()) as GoogleAuthorizeResponse;
  if (typeof data.authorization_url !== 'string') {
    throw new Error('Google login response was invalid.');
  }
  return data.authorization_url;
};

const waitForSsoMessage = (popup: Window, expectedOrigin: string): Promise<void> =>
  new Promise((resolve, reject) => {
    let completed = false;
    const finish = (callback: () => void): void => {
      if (completed) {
        return;
      }
      completed = true;
      globalThis.clearTimeout(timeoutId);
      globalThis.clearInterval(popupClosedIntervalId);
      window.removeEventListener('message', handleMessage);
      callback();
    };
    const handleMessage = (event: MessageEvent): void => {
      if (event.origin !== expectedOrigin || event.source !== popup) {
        return;
      }
      const parsedMessage = ssoCallbackMessageSchema.safeParse(event.data);
      if (!parsedMessage.success) {
        return;
      }
      const message = parsedMessage.data;
      if (message.status === 'success') {
        finish(resolve);
        return;
      }
      finish(() => reject(new Error(message.message)));
    };
    const timeoutId = globalThis.setTimeout(() => {
      finish(() => reject(new Error('Google login timed out. Please try again.')));
    }, SSO_TIMEOUT_MS);
    const popupClosedIntervalId = globalThis.setInterval(() => {
      if (popup.closed) {
        finish(() => reject(new Error('Google login was cancelled or did not complete.')));
      }
    }, POPUP_CLOSED_CHECK_MS);
    window.addEventListener('message', handleMessage);
  });

const startGoogleSso = async (): Promise<UserRead> => {
  const frontendCallbackUrl = getFrontendCallbackUrl();
  if (typeof window.open !== 'function') {
    throw new Error('Google login is only available in a browser.');
  }
  const popup = window.open('', GOOGLE_SSO_POPUP_NAME, GOOGLE_SSO_POPUP_FEATURES);
  if (!popup) {
    throw new Error('Could not open Google login popup. Please allow popups and try again.');
  }
  try {
    const authorizationUrl = await readAuthorizationUrl(frontendCallbackUrl);
    popup.location.href = authorizationUrl;
    await waitForSsoMessage(popup, window.location.origin);
    const currentUser = await fetchCurrentUser();
    if (!currentUser) {
      throw new Error('Google login completed, but no user session was found.');
    }
    return currentUser;
  } catch (error) {
    try {
      popup.close();
    } catch {
      // Popup may already be closed.
    }
    throw error;
  }
};

export function useGoogleSso() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: startGoogleSso,
    onSuccess: (currentUser) => {
      queryClient.setQueryData(['auth', 'me'], currentUser);
      router.replace('/tasks');
    },
  });
}
