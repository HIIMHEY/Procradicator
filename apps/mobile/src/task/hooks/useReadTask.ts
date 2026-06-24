import { API_ROUTES } from '@/config/env';
import { useQuery } from '@tanstack/react-query';
import { StatusCodes } from 'http-status-codes';

interface readTaskOptions {
  isEnabled?: boolean;
}

const readTask = async (id: string) => {
  const res = await fetch(`${API_ROUTES.TASKS.BASE}/${id}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw new Error(String(res.status));
  if (res.status == StatusCodes.NO_CONTENT) return {};
  return res.json();
};

export default function useReadTask(id: string, options: readTaskOptions = {}) {
  return useQuery({
    queryKey: ['task', id],
    queryFn: () => readTask(id),
    enabled: options.isEnabled ?? true,
  });
}
