import { API_ROUTES } from '@/config/env';
import { useQuery } from '@tanstack/react-query';

const readTask = async ({ id }: { id: string }) => {
  const res = await fetch(`${API_ROUTES.TASKS.BASE}/${id}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
};

export default function useReadTask({ id }: { id: string }) {
  return useQuery({
    queryKey: ['task', id],
    queryFn: () => readTask({ id }),
  });
}
