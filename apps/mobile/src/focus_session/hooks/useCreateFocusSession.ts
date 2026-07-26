import { API_ROUTES } from '@/config/env';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { FocusSessionResponse } from '../schemas';
import { FocusSessionResponseSchema } from '../schemas';

interface CreateFocusBody {
  subtask_id: string;
  work_cycle_m: number;
  rest_cycle_m: number;
}

interface FocusCreateVars extends CreateFocusBody {
  _tempId?: string;
}

const createSession = async (body: CreateFocusBody): Promise<FocusSessionResponse> => {
  const res = await fetch(API_ROUTES.FOCUS.BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(String(res.status));
  const data = await res.json();
  return FocusSessionResponseSchema.parse(data);
};

export default function useCreateFocusSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['focus', 'create'],
    mutationFn: async (body: CreateFocusBody): Promise<FocusSessionResponse & { _tempId?: string }> => {
      const pending = queryClient.getMutationCache().getAll().find(
        (m) =>
          m.options.mutationKey?.[0] === 'focus' &&
          m.options.mutationKey?.[1] === 'create' &&
          m.state.status === 'pending' &&
          m.state.variables !== body &&
          (m.state.variables as FocusCreateVars | undefined)?.subtask_id === body.subtask_id,
      );

      if (pending) {
        const vars = pending.state.variables as FocusCreateVars;
        return {
          id: vars._tempId as string,
          work_cycle_m: body.work_cycle_m,
          rest_cycle_m: body.rest_cycle_m,
          end_at: null,
        };
      }

      const tempId = crypto.randomUUID();
      const data = await createSession(body);
      return { ...data, _tempId: tempId };
    },
    onSuccess: (data) => {
      const realId = data.id;
      const tempId = data._tempId;
      if (tempId && realId !== tempId) {
        const cache = queryClient.getMutationCache();
        cache.getAll().forEach((m) => {
          const vars = m.state.variables as { sessionId?: string } | undefined;
          if (vars?.sessionId === tempId) {
            vars.sessionId = realId;
          }
        });
      }
    },
  });
}
