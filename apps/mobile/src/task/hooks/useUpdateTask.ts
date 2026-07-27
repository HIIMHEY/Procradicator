import { useCurrentUser } from '@/auth/hooks/useCurrentUser';
import { updateLocalTask } from '@/offline/taskStore';
import { requestSync } from '@/offline/TaskSyncProvider';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ModifyTaskData } from '../schema';

export default function useUpdateTask(id: string) {
  const client = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.id;
  return useMutation({
    mutationKey: ['task', userId, 'update', id],
    mutationFn: (values: ModifyTaskData) => {
      if (!userId) throw new Error('You must be logged in to update a task');
      return updateLocalTask(userId, id, values);
    },
    networkMode: 'always',
    onSuccess: (task) => {
      client.setQueryData(['task', userId, 'detail', id], task);
      void client.invalidateQueries({ queryKey: ['task', userId, 'list'] });
      requestSync();
    },
  });
}
