import { API_ROUTES } from '@/config/env';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const deleteTask = async (id: string) => {
  const res = await fetch(`${API_ROUTES.TASKS.BASE}/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
};

export default function useDeleteTask(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => deleteTask(id),
    onSettled: () => {
      client.invalidateQueries({ queryKey: ['task', id] });
    },
  });
}
