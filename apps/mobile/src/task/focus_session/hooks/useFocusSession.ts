import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import { API_ROUTES } from '@/config/env';
import useReadTask from '@/task/hooks/useReadTask';

import { focusReducer, initial } from '../focusReducer';
import type { Phase } from '../focusReducer';

export type UseFocusSessionResult = {
  phase: Phase;
  isOT: boolean;
  phaseStartedAt: number | null;
  workCycleM: number;
  restCycleM: number;
  currentSubtask: { title: string; description: string } | null;
  completedIds: string[];
  totalSubtasks: number;
  isHydrating: boolean;
  syncErrors: number;
  start: () => void;
  completeSubtask: () => void;
  enterOT: () => void;
  skipRest: () => void;
  requestExit: () => void;
  finalise: () => void;
  abandon: (reason: string) => void;
  closeExitReason: () => void;
};

export function useFocusSession(subtaskId: string, taskId: string): UseFocusSessionResult {
  const router = useRouter();
  const [state, dispatch] = useReducer(focusReducer, initial);
  const queryClient = useQueryClient();
  const hydratedRef = useRef(false);
  const workLogStartRef = useRef<string | null>(null);
  const [syncErrors, setSyncErrors] = useState(0);

  const { data: task } = useReadTask(taskId, {
    isEnabled: !!taskId,
  });

  const currentSubtask = task?.subtasks[state.currentIdx] ?? null;
  const hasMoreSubtasks = state.currentIdx < (task?.subtasks.length ?? 1) - 1;

  const createSession = useCallback(async () => {
    const res = await fetch(API_ROUTES.FOCUS.BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        subtask_id: subtaskId,
        work_cycle_m: initial.workCycleM,
        rest_cycle_m: initial.restCycleM,
      }),
    });
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  }, [subtaskId]);

  const [isHydrating, setIsHydrating] = useState(true);

  useEffect(() => {
    if (hydratedRef.current || !taskId) return;
    hydratedRef.current = true;

    createSession()
      .then((result: { id: string }) => {
        dispatch({
          type: 'SESSION_CREATED',
          sessionId: result.id,
          workCycleM: initial.workCycleM,
          restCycleM: initial.restCycleM,
        });
      })
      .catch(() => {})
      .finally(() => setIsHydrating(false));
  }, [taskId, createSession]);

  const start = useCallback(() => {
    workLogStartRef.current = new Date().toISOString();
    dispatch({ type: 'START_WORK' });
  }, []);

  const completeSubtask = useCallback(() => {
    if (!currentSubtask) return;
    const now = Date.now();
    dispatch({
      type: 'SUBTASK_COMPLETED',
      now,
      subtaskId: currentSubtask.id,
      nextExists: hasMoreSubtasks,
      startAt: workLogStartRef.current ?? new Date().toISOString(),
    });
    workLogStartRef.current = new Date().toISOString();
  }, [currentSubtask, hasMoreSubtasks]);

  const enterOT = useCallback(() => {
    dispatch({ type: 'ENTER_OT' });
  }, []);

  const skipRest = useCallback(() => {
    dispatch({ type: 'REST_COMPLETE', hasMore: hasMoreSubtasks });
  }, [hasMoreSubtasks]);

  const requestExit = useCallback(() => {
    if (state.completedIds.length > 0) {
      dispatch({ type: 'EXIT_TO_CONGRATS' });
    } else {
      dispatch({ type: 'OPEN_EXIT_REASON' });
    }
  }, [state.completedIds.length]);

  const updateSession = useCallback(
    async (overrides: Record<string, unknown>): Promise<void> => {
      if (!state.sessionId) throw new Error('No active session');
      const payload = {
        focus_logs: state.focusLogs,
        rest_logs: state.restLogs,
        completed_subtask_ids: state.completedIds,
        work_cycles: state.workCycles,
        rest_cycles: state.restCycles,
        total_overtime_s: state.OTSecondsTotal,
        ...overrides,
      };
      const res = await fetch(API_ROUTES.FOCUS.DETAIL(state.sessionId), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(String(res.status));
    },
    [state],
  );

  const finalise = useCallback(async () => {
    try {
      await updateSession({});
      queryClient.invalidateQueries({ queryKey: ['task', 'detail', taskId] });
      router.replace(`/tasks/${taskId}`);
    } catch {
      setSyncErrors((c) => c + 1);
    }
  }, [updateSession, queryClient, taskId, router]);

  const abandon = useCallback(
    async (reason: string) => {
      try {
        await updateSession({ abandon_reason: reason });
        queryClient.invalidateQueries({ queryKey: ['task', 'detail', taskId] });
        router.replace(`/tasks/${taskId}`);
      } catch {
        setSyncErrors((c) => c + 1);
      }
    },
    [updateSession, queryClient, taskId, router],
  );

  const closeExitReason = useCallback(() => {
    dispatch({ type: 'CLOSE_EXIT_REASON' });
  }, []);

  return {
    phase: state.phase,
    isOT: state.isOT,
    phaseStartedAt: state.phaseStartedAt,
    workCycleM: state.workCycleM,
    restCycleM: state.restCycleM,
    currentSubtask: currentSubtask
      ? { title: currentSubtask.title, description: currentSubtask.description ?? '' }
      : null,
    completedIds: state.completedIds,
    totalSubtasks: task?.subtasks.length ?? 0,
    isHydrating,
    syncErrors,
    start,
    completeSubtask,
    enterOT,
    skipRest,
    requestExit,
    finalise,
    abandon,
    closeExitReason,
  };
}
