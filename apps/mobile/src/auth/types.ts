export type UserRead = {
  id: string;
  email: string;
  username: string;
  is_active: boolean;
  is_superuser: boolean;
  is_verified: boolean;
  created_at?: string;
};

export type { LoginInput, RegisterInput } from './schemas';
