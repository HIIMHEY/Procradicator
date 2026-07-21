import { useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';

import useReadTask from '@/task/hooks/useReadTask';
import { buildDepMap, toposort } from '@/task/utils';

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
  hydrationError: Error | null;
  retryHydration: () => void;
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

type SyncPosition = { logs: number; rests: number; completed: number };

function getSyncPosition(s: State): SyncPosition {
  return {
    logs: s.focusLogs.length,
    rests: s.restLogs.length,
    completed: s.completedIds.length,
  };
}

function isSamePosition(a: SyncPosition, b: SyncPosition): boolean {
  return a.logs === b.logs && a.rests === b.rests && a.completed === b.completed;
}

function buildPendingPayload(
  s: State,
  position: SyncPosition,
  overrides?: Partial<UpdateFocusPayload>,
): UpdateFocusPayload {
  return buildPayload(s, {
    focus_logs: s.focusLogs.slice(position.logs),
    rest_logs: s.restLogs.slice(position.rests),
    completed_subtask_ids: s.completedIds.slice(position.completed),
    ...overrides,
  });
}

export function useFocusSession(subtaskId: string, taskId: string): UseFocusSessionResult {
  const router = useRouter();
  const navigation = useNavigation();
  const [state, dispatch] = useReducer(focusReducer, initial);
  const queryClient = useQueryClient();
  const hydratedRef = useRef(false);
  const allowNavigationRef = useRef(false);
  const workLogStartRef = useRef<string | null>(null);
  const syncedDataRef = useRef<SyncPosition>({ logs: 0, rests: 0, completed: 0 });
  const scheduledDataRef = useRef<SyncPosition>({ logs: 0, rests: 0, completed: 0 });
  const updateQueueRef = useRef<Promise<void>>(Promise.resolve());
  const stateRef = useRef(state);
  stateRef.current = state;

  const allowNavigation = useCallback(() => {
    allowNavigationRef.current = true;
  }, []);
  const createSessionMut = useCreateFocusSession();
  const updateSessionMut = useUpdateFocusSession();
  const finaliseSessionMut = useFinaliseFocusSession(taskId, allowNavigation);
  const createSession = createSessionMut.mutateAsync;
  const updateSession = updateSessionMut.mutateAsync;
  const finaliseSession = finaliseSessionMut.mutateAsync;

  const {
    data: task,
    error: taskError,
    isPending: isTaskPending,
    refetch: refetchTask,
  } = useReadTask(taskId, {
    isEnabled: !!taskId,
  });
  const subtasks = useMemo(() => {
    const taskSubtasks = task?.subtasks ?? [];
    return toposort(taskSubtasks, buildDepMap(taskSubtasks));
  }, [task]);
  const subtasksRef = useRef(subtasks);
  subtasksRef.current = subtasks;

  const currentSubtask = subtasks[state.currentIdx] ?? null;

  const totalFocusTimeS = state.focusLogs.reduce(
    (acc, log) => acc + dayjs(log.stop_at).diff(dayjs(log.start_at), 'second'),
    0,
  );

  const [isHydrating, setIsHydrating] = useState(true);
  const [hydrationError, setHydrationError] = useState<Error | null>(null);
  const [hydrationAttempt, setHydrationAttempt] = useState(0);

  useEffect(() => {
    if (hydratedRef.current) return;
    if (!taskId || !subtaskId) {
      setHydrationError(new Error('Focus session details are missing.'));
      setIsHydrating(false);
      return;
    }
    if (isTaskPending) return;
    if (taskError) {
      setHydrationError(taskError);
      setIsHydrating(false);
      return;
    }
    if (subtasks.length === 0) {
      setHydrationError(new Error('This task has no available subtasks.'));
      setIsHydrating(false);
      return;
    }
    const currentIdx = subtasks.findIndex((subtask) => subtask.id === subtaskId);
    if (currentIdx < 0) {
      setHydrationError(new Error('The selected subtask could not be found.'));
      setIsHydrating(false);
      return;
    }
    hydratedRef.current = true;
    setHydrationError(null);
    setIsHydrating(true);
    let active = true;

    createSession({
      subtask_id: subtaskId,
      work_cycle_m: initial.workCycleM,
      rest_cycle_m: initial.restCycleM,
    })
      .then((result) => {
        if (!active) return;
        dispatch({
          type: 'CREATE_SESSION',
          sessionId: result.id,
          workCycleM: initial.workCycleM,
          restCycleM: initial.restCycleM,
          currentIdx,
        });
        setIsHydrating(false);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setHydrationError(
          error instanceof Error ? error : new Error('Could not start the focus session.'),
        );
        setIsHydrating(false);
      });

    return () => {
      active = false;
    };
  }, [taskId, subtaskId, subtasks, isTaskPending, taskError, createSession, hydrationAttempt]);

  const retryHydration = useCallback(() => {
    hydratedRef.current = true;
    setHydrationError(null);
    setIsHydrating(true);
    void refetchTask().then((result) => {
      if (result.error) {
        setHydrationError(result.error);
        setIsHydrating(false);
        return;
      }
      hydratedRef.current = false;
      setHydrationAttempt((attempt) => attempt + 1);
    });
  }, [refetchTask]);

  const enqueueUpdate = useCallback(
    (snapshot: State, overrides?: Partial<UpdateFocusPayload>, isFinal = false): Promise<void> => {
      const sessionId = snapshot.sessionId;
      if (!sessionId) return Promise.resolve();
      const targetPosition = getSyncPosition(snapshot);
      const operation = async () => {
        const payload = buildPendingPayload(snapshot, syncedDataRef.current, overrides);
        const variables = { sessionId, payload };
        if (isFinal) {
          await finaliseSession(variables);
        } else {
          await updateSession(variables);
        }
        syncedDataRef.current = targetPosition;
      };
      const queued = updateQueueRef.current.then(operation);
      updateQueueRef.current = queued.catch(() => {});
      return queued;
    },
    [updateSession, finaliseSession],
  );

  useEffect(() => {
    const s = stateRef.current;
    if (!s.sessionId) return;
    const targetPosition = getSyncPosition(s);
    if (isSamePosition(targetPosition, scheduledDataRef.current)) return;
    scheduledDataRef.current = targetPosition;
    enqueueUpdate(s).catch(() => {
      if (isSamePosition(scheduledDataRef.current, targetPosition)) {
        scheduledDataRef.current = syncedDataRef.current;
      }
    });
  }, [state.focusLogs, state.restLogs, state.completedIds, state.sessionId, enqueueUpdate]);

  const start = useCallback(() => {
    workLogStartRef.current = new Date().toISOString();
    dispatch({ type: 'START_WORK' });
  }, []);

  const completeSubtask = useCallback((OTSeconds: number = 0) => {
    const s = stateRef.current;
    const currentSubtasks = subtasksRef.current;
    const subtask = currentSubtasks[s.currentIdx];
    if (!subtask) return;
    const total = currentSubtasks.length;
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
    const total = subtasksRef.current.length;
    const hasMore = s.currentIdx < total - 1;
    dispatch({ type: 'REST_END', hasMore, incrCycles: false });
  }, []);

  const completeRest = useCallback(() => {
    const s = stateRef.current;
    const total = subtasksRef.current.length;
    const hasMore = s.currentIdx < total - 1;
    dispatch({ type: 'REST_END', hasMore, incrCycles: true });
  }, []);

  const requestExit = useCallback(() => {
    const s = stateRef.current;
    if (s.completedIds.length > 0) {
      const subtask = subtasksRef.current[s.currentIdx];
      dispatch({ type: 'EXIT_TO_CONGRATS', subtaskId: subtask?.id ?? null });
    } else {
      dispatch({ type: 'OPEN_EXIT_REASON' });
    }
  }, []);

  usePreventRemove(Boolean(state.sessionId) || createSessionMut.isPending, ({ data }) => {
    if (allowNavigationRef.current) {
      navigation.dispatch(data.action);
      return;
    }
    requestExit();
  });

  const finalise = useCallback(() => {
    const s = stateRef.current;
    if (!s.sessionId) return;
    scheduledDataRef.current = getSyncPosition(s);
    enqueueUpdate(s, { total_overtime_s: s.OTSecondsTotal }, true).catch(() => {});
  }, [enqueueUpdate]);

  const abandon = useCallback(
    async (reason: string) => {
      const s = stateRef.current;
      if (!s.sessionId) return;
      const subtask = subtasksRef.current[s.currentIdx];
      const action = {
        type: 'ABANDON_SESSION',
        subtaskId: subtask?.id ?? null,
        reason,
      } as const;
      const nextState = focusReducer(s, action);
      scheduledDataRef.current = getSyncPosition(nextState);
      await enqueueUpdate(nextState, { abandon_reason: reason });
      queryClient.invalidateQueries({ queryKey: ['task', 'detail', taskId] });
      allowNavigation();
      router.replace(`/tasks/${taskId}`);
    },
    [enqueueUpdate, queryClient, taskId, allowNavigation, router],
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
    totalSubtasks: subtasks.length,
    totalFocusTimeS,
    isHydrating,
    hydrationError,
    retryHydration,
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
