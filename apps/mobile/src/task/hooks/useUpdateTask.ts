import { API_ROUTES } from '@/config/env';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ModifyTaskData } from '../schema';

const updateTask = (id: string) => async (values: ModifyTaskData) => {
  const res = await fetch(`${API_ROUTES.TASKS.BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
    credentials: 'include',
  });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
};

export default function useUpdateTask(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: updateTask(id),
    onSettled: () => {
      client.invalidateQueries({ queryKey: ['task', id] });
    },
  });
}
