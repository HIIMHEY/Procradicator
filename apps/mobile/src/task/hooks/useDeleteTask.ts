import { API_ROUTES } from '@/config/env';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { StatusCodes } from 'http-status-codes';

const deleteTask = async (id: string) => {
  const res = await fetch(`${API_ROUTES.TASKS.BASE}/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw new Error(String(res.status));
  if (res.status == StatusCodes.NO_CONTENT) return {};
  return res.json();
};

export default function useDeleteTask(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => deleteTask(id),
    onSettled: () => {
      client.invalidateQueries({ queryKey: ['task', 'task-list', id] });
    },
  });
}
