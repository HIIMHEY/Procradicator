import { API_ROUTES } from '@/config/env';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { userReadSchema } from '../schemas';
import type { UserRead } from '../types';

type GoogleAuthorizeResponse = {
  authorization_url?: unknown;
};

const POLL_INTERVAL_MS = 500; //call /auth/me every 0.5s
const SSO_TIMEOUT_MS = 15_000;

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

//Gets Google login URL from backend
const readAuthorizationUrl = async (): Promise<string> => {
  const response = await fetch(API_ROUTES.AUTH.GOOGLE_AUTHORIZE, {
    method: 'GET',
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Could not start Google login.');
  }
  const data = (await response.json()) as GoogleAuthorizeResponse;
  if (typeof data.authorization_url !== 'string') {
    throw new Error('Google login response was invalid.');
  }
  return data.authorization_url;
};

//Checks whether the backend has finished logging the user in via /auth/me
//A 401 means the OAuth callback has not completed yet
const readCurrentUserAfterSso = async (): Promise<UserRead | null> => {
  const response = await fetch(API_ROUTES.AUTH.ME, {
    method: 'GET',
    credentials: 'include',
  });
  if (response.status === 401) {
    return null; //Google login not finished yet
  }
  if (!response.ok) {
    throw new Error('Could not check Google login.');
  }
  const data = await response.json();
  return userReadSchema.parse(data);
};

//Opens Google and polls /auth/me while the popup remains open
const startGoogleSso = async (): Promise<UserRead> => {
  const authorizationUrl = await readAuthorizationUrl();
  let popupClosed = false;
  let popupError: Error | null = null;
  //Opens the popup, then continues running while loop.
  void WebBrowser.openAuthSessionAsync(authorizationUrl, API_ROUTES.AUTH.GOOGLE_CALLBACK)
    //Runs later when openAuthSessionAsync returns result, result is what happened to popup
    .then((result) => {
      if (result.type !== 'success') {
        popupClosed = true;
      }
    })
    //If opening popup results in error
    .catch((error: unknown) => {
      popupError = error instanceof Error ? error : new Error('Could not open Google login.');
    });
  const deadline = Date.now() + SSO_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const currentUser = await readCurrentUserAfterSso();
    if (currentUser) {
      try {
        WebBrowser.dismissAuthSession(); //Close popup
      } catch {
        //The popup may already be closed or dismissal may be unavailable
      }
      return currentUser;
    }
    if (popupError) {
      throw popupError;
    }
    if (popupClosed) {
      throw new Error('Google login was cancelled or did not complete.');
    }
    await wait(POLL_INTERVAL_MS);
  }
  try {
    WebBrowser.dismissAuthSession();
  } catch {
    //Nothing else is required if the popup cannot be dismissed
  }
  throw new Error('Google login timed out. Please try again.');
};

export function useGoogleSso() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: startGoogleSso,
    onSuccess: async (currentUser) => {
      queryClient.setQueryData(['auth', 'me'], currentUser);
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      router.replace('/tasks');
    },
  });
}
