import { useCurrentUser } from '@/auth/hooks/useCurrentUser';
import { createLocalTask } from '@/offline/taskStore';
import { requestTaskSync } from '@/offline/TaskSyncProvider';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ModifyTaskData } from '../schema';

export default function useCreateTask() {
  const client = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.id;
  return useMutation({
    mutationKey: ['task', userId, 'create'],
    mutationFn: (values: ModifyTaskData) => {
      if (!userId) throw new Error('You must be logged in to create a task');
      return createLocalTask(userId, values);
    },
    networkMode: 'always',
    onSuccess: (task) => {
      client.setQueryData(['task', userId, 'detail', task.id], task);
      void client.invalidateQueries({ queryKey: ['task', userId, 'list'] });
      requestTaskSync();
    },
  });
}
