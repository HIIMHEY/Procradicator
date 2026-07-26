import { API_ROUTES } from '@/config/env';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ModifyTaskData } from '../schema';

const createTask = async (values: ModifyTaskData) => {
  const res = await fetch(API_ROUTES.TASKS.BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
    credentials: 'include',
  });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
};

export default function useCreateTask() {
  const client = useQueryClient();
  return useMutation({
    mutationKey: ['task', 'create'],
    mutationFn: createTask,
    onMutate: async (_values) => {
      await client.cancelQueries({ queryKey: ['task', 'list'] });
      const tempId = crypto.randomUUID();
      return { tempId };
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['task', 'list'] });
    },
    onSettled: () => {
      client.invalidateQueries({ queryKey: ['task', 'list'] });
    },
  });
}
