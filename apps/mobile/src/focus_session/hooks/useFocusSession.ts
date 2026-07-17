import { useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import useReadTask from '@/task/hooks/useReadTask';

import { focusReducer, initial, State } from '../focusReducer';
import type { Phase } from '../focusReducer';
import type { UpdateFocusPayload } from '../schemas';
import useCreateFocusSession from './useCreateFocusSession';
import useUpdateFocusSession from './useUpdateFocusSession';
import useFinaliseFocusSession from './useFinaliseFocusSession';

export type UseFocusSessionResult = {
  phase: Phase;
  isOT: boolean;
  phaseStartedAt: number | null;
  workCycleM: number;
  restCycleM: number;
  currentSubtask: { title: string; description: string } | null;
  completedIds: string[];
  totalSubtasks: number;
  totalFocusTimeS: number;
  isHydrating: boolean;
  start: () => void;
  completeSubtask: (OTSeconds?: number) => void;
  enterOT: () => void;
  skipRest: () => void;
  completeRest: () => void;
  requestExit: () => void;
  finalise: () => void;
  isFinishing: boolean;
  abandon: (reason: string) => void;
  closeExitReason: () => void;
};

function buildPayload(s: State, overrides?: Partial<UpdateFocusPayload>): UpdateFocusPayload {
  return {
    focus_logs: overrides?.focus_logs ?? s.focusLogs,
    rest_logs: overrides?.rest_logs ?? s.restLogs,
    completed_subtask_ids: overrides?.completed_subtask_ids ?? s.completedIds,
    work_cycles: overrides?.work_cycles ?? s.workCycles,
    rest_cycles: overrides?.rest_cycles ?? s.restCycles,
    ...(overrides?.total_overtime_s !== undefined && {
      total_overtime_s: overrides.total_overtime_s,
    }),
    ...(overrides?.abandon_reason !== undefined && { abandon_reason: overrides.abandon_reason }),
  };
}

export function useFocusSession(subtaskId: string, taskId: string): UseFocusSessionResult {
  const router = useRouter();
  const [state, dispatch] = useReducer(focusReducer, initial);
  const queryClient = useQueryClient();
  const hydratedRef = useRef(false);
  const workLogStartRef = useRef<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const createSessionMut = useCreateFocusSession();
  const updateSessionMut = useUpdateFocusSession();
  const finaliseSessionMut = useFinaliseFocusSession(taskId);

  const { data: task } = useReadTask(taskId, {
    isEnabled: !!taskId,
  });
  const taskRef = useRef(task);
  taskRef.current = task;

  const currentSubtask = task?.subtasks[state.currentIdx] ?? null;

  const totalFocusTimeS = state.focusLogs.reduce(
    (acc, log) => acc + dayjs(log.stop_at).diff(dayjs(log.start_at), 'second'),
    0,
  );

  const [isHydrating, setIsHydrating] = useState(true);

  useEffect(() => {
    if (hydratedRef.current || !taskId) return;
    hydratedRef.current = true;

    createSessionMut
      .mutateAsync({
        subtask_id: subtaskId,
        work_cycle_m: initial.workCycleM,
        rest_cycle_m: initial.restCycleM,
      })
      .then((result) => {
        dispatch({
          type: 'CREATE_SESSION',
          sessionId: result.id,
          workCycleM: initial.workCycleM,
          restCycleM: initial.restCycleM,
        });
      })
      .catch(() => {})
      .finally(() => setIsHydrating(false));
  }, [taskId, subtaskId, createSessionMut]);

  const prevDataRef = useRef({ logs: 0, rests: 0, completed: 0 });
  useEffect(() => {
    const s = stateRef.current;
    if (!s.sessionId) return;
    const newLogs = s.focusLogs.length;
    const newRests = s.restLogs.length;
    const newCompleted = s.completedIds.length;
    const p = prevDataRef.current;
    if (newLogs === p.logs && newRests === p.rests && newCompleted === p.completed) return;
    prevDataRef.current = { logs: newLogs, rests: newRests, completed: newCompleted };
    updateSessionMut
      .mutateAsync({ sessionId: s.sessionId, payload: buildPayload(s) })
      .catch(() => {});
  }, [state.focusLogs, state.restLogs, state.completedIds, state.sessionId, updateSessionMut]);

  const start = useCallback(() => {
    workLogStartRef.current = new Date().toISOString();
    dispatch({ type: 'START_WORK' });
  }, []);

  const completeSubtask = useCallback((OTSeconds: number = 0) => {
    const s = stateRef.current;
    const t = taskRef.current;
    const subtask = t?.subtasks[s.currentIdx];
    if (!subtask) return;
    const total = t?.subtasks.length ?? 0;
    const hasMore = s.currentIdx < total - 1;
    const now = Date.now();
    dispatch({
      type: 'COMPLETE_SUBTASK',
      now,
      subtaskId: subtask.id,
      nextExists: hasMore,
      startAt: workLogStartRef.current ?? new Date().toISOString(),
      OTSeconds,
    });
    workLogStartRef.current = new Date().toISOString();
  }, []);

  const enterOT = useCallback(() => {
    dispatch({ type: 'ENTER_OT' });
  }, []);

  const skipRest = useCallback(() => {
    const s = stateRef.current;
    const t = taskRef.current;
    const total = t?.subtasks.length ?? 0;
    const hasMore = s.currentIdx < total - 1;
    dispatch({ type: 'REST_END', hasMore, incrCycles: false });
  }, []);

  const completeRest = useCallback(() => {
    const s = stateRef.current;
    const t = taskRef.current;
    const total = t?.subtasks.length ?? 0;
    const hasMore = s.currentIdx < total - 1;
    dispatch({ type: 'REST_END', hasMore, incrCycles: true });
  }, []);

  const requestExit = useCallback(() => {
    const s = stateRef.current;
    if (s.completedIds.length > 0) {
      dispatch({ type: 'EXIT_TO_CONGRATS' });
    } else {
      dispatch({ type: 'OPEN_EXIT_REASON' });
    }
  }, []);

  const finalise = useCallback(() => {
    const s = stateRef.current;
    if (!s.sessionId) return;
    finaliseSessionMut.mutate({
      sessionId: s.sessionId,
      payload: buildPayload(s, { total_overtime_s: s.OTSecondsTotal }),
    });
  }, []);

  const abandon = useCallback(
    async (reason: string) => {
      const s = stateRef.current;
      if (!s.sessionId) return;
      const t = taskRef.current;
      const subtask = t?.subtasks[s.currentIdx];
      dispatch({
        type: 'ABANDON_SESSION',
        subtaskId: subtask?.id ?? null,
        reason,
      });
      await updateSessionMut.mutateAsync({
        sessionId: s.sessionId,
        payload: buildPayload(s, { abandon_reason: reason }),
      });
      queryClient.invalidateQueries({ queryKey: ['task', 'detail', taskId] });
      router.replace(`/tasks/${taskId}`);
    },
    [updateSessionMut, queryClient, taskId, router],
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
    totalFocusTimeS,
    isHydrating,
    start,
    completeSubtask,
    enterOT,
    skipRest,
    completeRest,
    requestExit,
    finalise,
    isFinishing: finaliseSessionMut.isPending,
    abandon,
    closeExitReason,
  };
}
