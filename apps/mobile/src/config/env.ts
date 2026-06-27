const DEFAULT_API_BASE_URL = 'http://localhost:8000';

const BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, '');

export const API_ROUTES = {
  CHAT_SESSION: {},
  FOCUS_SESSIONS: {
    BASE: `${BASE_URL}/focus-sessions`,
    ACTIVE: `${BASE_URL}/focus-sessions/active`,
    DETAIL: (sessionId: string) => `${BASE_URL}/focus-sessions/${sessionId}`,
    EXIT_ATTEMPT: (sessionId: string) => `${BASE_URL}/focus-sessions/${sessionId}/exit-attempt`,
    WORK_COMPLETE: (sessionId: string) => `${BASE_URL}/focus-sessions/${sessionId}/work-complete`,
    REST_COMPLETE: (sessionId: string) => `${BASE_URL}/focus-sessions/${sessionId}/rest-complete`,
    RESUME: (sessionId: string) => `${BASE_URL}/focus-sessions/${sessionId}/resume`,
    ABANDON: (sessionId: string) => `${BASE_URL}/focus-sessions/${sessionId}/abandon`,
  },
  TASKS: {
    BASE: `${BASE_URL}/tasks`,
    DETAIL: (id: string) => `${BASE_URL}/tasks/${id}`,
  },
  AUTH: {
    REGISTER: `${BASE_URL}/auth/register`,
    LOGIN: `${BASE_URL}/auth/login`,
    LOGOUT: `${BASE_URL}/auth/logout`,
    ME: `${BASE_URL}/auth/me`,
    GOOGLE_AUTHORIZE: `${BASE_URL}/auth/google/authorize`,
    GOOGLE_CALLBACK: `${BASE_URL}/auth/google/callback`,
  },
};
