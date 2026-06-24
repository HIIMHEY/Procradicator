import type { SsoCallbackMessage } from '@/auth/schemas';
import { ssoCallbackMessageSchema } from '@/auth/schemas';
import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { API_ROUTES } from '@/config/env';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

const getSearchParam = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
};

const getWindowOrigin = (): string | null => {
  if (typeof window === 'undefined' || !window.location?.origin) {
    return null;
  }
  return window.location.origin;
};

const getFrontendCallbackUrl = (): string => {
  const origin = getWindowOrigin();
  if (!origin) {
    throw new Error('Google sign in can only complete in a web browser.');
  }
  return `${origin}/auth/sso/callback`;
};

const buildBackendCallbackUrl = (code: string, state: string): string => {
  const callbackUrl = new URL(API_ROUTES.AUTH.GOOGLE_CALLBACK);
  callbackUrl.searchParams.set('code', code);
  callbackUrl.searchParams.set('state', state);
  callbackUrl.searchParams.set('redirect_uri', getFrontendCallbackUrl());
  return callbackUrl.toString();
};

const postSsoMessage = (message: SsoCallbackMessage): void => {
  const origin = getWindowOrigin();
  if (typeof window === 'undefined' || !window.opener || !origin) {
    return;
  }
  window.opener.postMessage(message, origin);
};

const postErrorMessage = (message: string): void => {
  postSsoMessage({
    type: 'procradicator:sso-complete',
    provider: 'google',
    status: 'error',
    message,
  });
};

const closePopup = (): void => {
  window.setTimeout(() => {
    window.close();
  }, 100);
};

export default function SsoCallback() {
  const searchParams = useLocalSearchParams<{
    code?: string | string[];
    state?: string | string[];
    error?: string | string[];
  }>();
  const code = getSearchParam(searchParams.code);
  const state = getSearchParam(searchParams.state);
  const oauthError = getSearchParam(searchParams.error);
  const [statusMessage, setStatusMessage] = useState('Completing Google sign in...');
  useEffect(() => {
    let isMounted = true;
    const finishWithMessage = (message: string): void => {
      if (isMounted) {
        setStatusMessage(message);
      }
      closePopup();
    };
    const completeSso = async (): Promise<void> => {
      if (typeof window === 'undefined') {
        return;
      }
      if (oauthError) {
        postErrorMessage(oauthError);
        finishWithMessage('Google sign in failed. You can close this window.');
        return;
      }
      if (!code || !state) {
        postErrorMessage('Google sign in callback was missing required data.');
        finishWithMessage('Google sign in failed. You can close this window.');
        return;
      }
      try {
        const response = await fetch(buildBackendCallbackUrl(code, state), {
          method: 'GET',
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Google sign in failed.');
        }
        const message: SsoCallbackMessage = {
          type: 'procradicator:sso-complete',
          provider: 'google',
          status: 'success',
        };
        const parsedMessage = ssoCallbackMessageSchema.parse(message);
        postSsoMessage(parsedMessage);
        finishWithMessage('Google sign in completed. You can close this window.');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Google sign in failed.';
        postErrorMessage(message);
        finishWithMessage('Google sign in failed. You can close this window.');
      }
    };
    void completeSso();
    return () => {
      isMounted = false;
    };
  }, [code, oauthError, state]);
  return (
    <Box className="flex-1 items-center justify-center bg-white px-8">
      <Text className="text-center text-base text-slate-700">{statusMessage}</Text>
    </Box>
  );
}
