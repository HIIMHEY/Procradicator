const DEFAULT_API_BASE_URL = 'http://localhost:8000';

const BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL).replace(
  /\/$/,
  '',
);

export const API_ROUTES = {
  CHAT_SESSION: {},
  TASKS: {
    BASE: `${BASE_URL}/tasks/`,
    DETAIL: (id: string) => `${BASE_URL}/tasks/${id}`,
  },
  AUTH: {
    REGISTER: `${BASE_URL}/auth/register`,
    LOGIN: `${BASE_URL}/auth/login`,
    LOGOUT: `${BASE_URL}/auth/logout`,
  },
};
