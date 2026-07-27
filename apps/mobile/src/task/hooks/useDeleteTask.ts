import { useCurrentUser } from '@/auth/hooks/useCurrentUser';
import { deleteLocalTask } from '@/offline/taskStore';
import { requestSync } from '@/offline/TaskSyncProvider';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export default function useDeleteTask(id: string) {
  const client = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.id;
  return useMutation({
    mutationKey: ['task', userId, 'delete', id],
    mutationFn: async () => {
      if (!userId) throw new Error('You must be logged in to delete a task');
      await deleteLocalTask(userId, id);
    },
    networkMode: 'always',
    onSuccess: () => {
      client.setQueryData(['task', userId, 'detail', id], null);
      void client.invalidateQueries({ queryKey: ['task', userId, 'list'] });
      requestSync();
    },
  });
}
