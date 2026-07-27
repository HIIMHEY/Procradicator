import type { QueryClient } from '@tanstack/react-query';
import { API_ROUTES } from '@/config/env';
import { writeConflict } from '@/offline/storage';
import { StatusCodes } from 'http-status-codes';

export function registerMutationDefaults(client: QueryClient) {
  client.setMutationDefaults(['task', 'create'], {
    mutationFn: async (values: unknown) => {
      const res = await fetch(API_ROUTES.TASKS.BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
        credentials: 'include',
      });
      if (!res.ok) throw new Error(String(res.status));
      return res.json();
    },
  });

  client.setMutationDefaults(['task', 'update'], {
    mutationFn: async ({ id, values }: { id: string; values: unknown }) => {
      const res = await fetch(`${API_ROUTES.TASKS.BASE}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
        credentials: 'include',
      });
      if (res.status === StatusCodes.CONFLICT) {
        const serverData = await res.json();
        const err = new Error('Conflict') as Error & { serverVersion: unknown; localData: unknown };
        err.serverVersion = serverData;
        err.localData = values;
        throw err;
      }
      if (!res.ok) throw new Error(String(res.status));
      if (res.status === StatusCodes.NO_CONTENT) return {};
      return res.json();
    },
  });

  client.setMutationDefaults(['task', 'delete'], {
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_ROUTES.TASKS.BASE}/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!res.ok) throw new Error(String(res.status));
      if (res.status === StatusCodes.NO_CONTENT) return {};
      return res.json();
    },
  });

  client.setMutationDefaults(['focus', 'create'], {
    mutationFn: async (body: {
      subtask_id: string;
      work_cycle_m: number;
      rest_cycle_m: number;
    }) => {
      const res = await fetch(API_ROUTES.FOCUS.BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      return {
        id: data.id as string,
        work_cycle_m: data.work_cycle_m as number,
        rest_cycle_m: data.rest_cycle_m as number,
        end_at: (data.end_at ?? null) as string | null,
      };
    },
  });

  client.setMutationDefaults(['focus', 'update'], {
    mutationFn: async ({ sessionId, payload }: { sessionId: string; payload: unknown }) => {
      const res = await fetch(API_ROUTES.FOCUS.DETAIL(sessionId), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(String(res.status));
    },
  });

  client.setMutationDefaults(['focus', 'finalise'], {
    mutationFn: async ({ sessionId, payload }: { sessionId: string; payload: unknown }) => {
      const res = await fetch(API_ROUTES.FOCUS.DETAIL(sessionId), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(String(res.status));
    },
  });

  client.setMutationDefaults(['auth', 'logout'], {
    mutationFn: async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      const res = await fetch(API_ROUTES.AUTH.LOGOUT, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(String(res.status));
    },
  });
}

export async function storeConflict(
  entityType: 'task',
  entityId: string,
  localData: unknown,
  serverData: unknown,
  localUpdatedAt: string,
  serverUpdatedAt: string,
): Promise<void> {
  await writeConflict({
    entityType,
    entityId,
    localData,
    serverData,
    localUpdatedAt,
    serverUpdatedAt,
  });
}
