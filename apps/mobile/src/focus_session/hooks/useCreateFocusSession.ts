import { API_ROUTES } from '@/config/env';
import { useMutation } from '@tanstack/react-query';

const createSession = async (body: {
  subtask_id: string;
  work_cycle_m: number;
  rest_cycle_m: number;
}): Promise<{ id: string }> => {
  const res = await fetch(API_ROUTES.FOCUS.BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
};

export default function useCreateFocusSession() {
  return useMutation({ mutationFn: createSession });
}
