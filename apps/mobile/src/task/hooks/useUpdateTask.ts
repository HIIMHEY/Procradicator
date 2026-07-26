import { API_ROUTES } from '@/config/env';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ModifyTaskData } from '../schema';
import { StatusCodes } from 'http-status-codes';
import { storeConflict } from '@/offline/mutationDefaults';

interface ConflictError extends Error {
  serverVersion: Record<string, unknown>;
}

const updateTask = (id: string) => async (values: ModifyTaskData) => {
  const res = await fetch(`${API_ROUTES.TASKS.BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
    credentials: 'include',
  });
  if (res.status === StatusCodes.CONFLICT) {
    const serverData = (await res.json()) as Record<string, unknown>;
    const err = new Error('Conflict') as ConflictError;
    err.serverVersion = serverData;
    throw err;
  }
  if (!res.ok) throw new Error(String(res.status));
  if (res.status === StatusCodes.NO_CONTENT) return {};
  return res.json();
};

export default function useUpdateTask(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationKey: ['task', 'update'],
    mutationFn: updateTask(id),
    onError: async (error: unknown, variables) => {
      const conflictErr = error as ConflictError | undefined;
      if (conflictErr?.serverVersion) {
        const serverData = conflictErr.serverVersion;
        const localUpdatedAt =
          (variables as ModifyTaskData & { updated_at?: string })?.updated_at ??
          new Date().toISOString();
        const serverUpdatedAt = (serverData.updated_at as string) ?? new Date().toISOString();
        await storeConflict(
          'task',
          id,
          variables,
          serverData,
          localUpdatedAt,
          serverUpdatedAt,
        );
      }
    },
    onSettled: () => {
      client.invalidateQueries({ queryKey: ['task', 'list'] });
      client.invalidateQueries({ queryKey: ['task', 'detail', id] });
    },
  });
}
