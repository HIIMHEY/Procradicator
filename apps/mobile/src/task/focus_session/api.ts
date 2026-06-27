import { API_ROUTES } from '@/config/env';
import type {
  AbandonFocusSessionData,
  CreateFocusSessionData,
  FocusSession,
  FocusSessionAction,
} from './schemas';
import { ActiveFocusSessionSchema, FocusSessionSchema } from './schemas';

type FocusSessionActionPayload = AbandonFocusSessionData | undefined;

const parseFocusSessionResponse = async (response: Response): Promise<FocusSession> => {
  if (!response.ok) {
    throw new Error(String(response.status));
  }
  const data = await response.json();
  return FocusSessionSchema.parse(data);
};

export const startFocusSession = async (payload: CreateFocusSessionData): Promise<FocusSession> => {
  const response = await fetch(API_ROUTES.FOCUS.BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  return parseFocusSessionResponse(response);
};

export const readActiveFocusSession = async (): Promise<FocusSession | null> => {
  const response = await fetch(API_ROUTES.FOCUS.ACTIVE, {
    method: 'GET',
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(String(response.status));
  }
  const data = await response.json();
  return ActiveFocusSessionSchema.parse(data);
};

export const readFocusSession = async (sessionId: string): Promise<FocusSession> => {
  const response = await fetch(API_ROUTES.FOCUS.DETAIL(sessionId), {
    method: 'GET',
    credentials: 'include',
  });
  return parseFocusSessionResponse(response);
};

export const updateFocusSession = async (
  sessionId: string,
  action: FocusSessionAction,
  payload?: FocusSessionActionPayload,
): Promise<FocusSession> => {
  const request: RequestInit = {
    method: 'POST',
    credentials: 'include',
  };
  if (payload !== undefined) {
    request.headers = { 'Content-Type': 'application/json' };
    request.body = JSON.stringify(payload);
  }
  const response = await fetch(API_ROUTES.FOCUS.ACTION(sessionId, action), request);
  return parseFocusSessionResponse(response);
};
