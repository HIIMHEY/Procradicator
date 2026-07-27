import { useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';

import useReadTask from '@/task/hooks/useReadTask';
import { buildDepMap, toposort } from '@/task/utils';
import { useCurrentUser } from '@/auth/hooks/useCurrentUser';
import {
  findLocalFocusSession,
  saveLocalFocusState,
} from '@/offline/focusStore';

import { focusReducer, initial, State } from '../focusReducer';
import type { Phase } from '../focusReducer';
import type { FocusSessionRecovery, SyncPosition, UpdateFocusPayload } from '../schemas';
import {
  readRecovery,
  writeRecovery as idbWriteRecovery,
  clearRecovery as idbClearRecovery,
} from '@/offline/storage';
import useCreateFocusSession from './useCreateFocusSession';
import useUpdateFocusSession from './useUpdateFocusSession';
import useFinaliseFocusSession from './useFinaliseFocusSession';
import useReadFocusSession from './useReadFocusSession';

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

function getRecoveryKey(taskId: string, subtaskId: string): string {
  return `focus-session:${taskId}:${subtaskId}`;
}

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
  const { data: currentUser, isPending: isCurrentUserPending } = useCurrentUser();
  const userId = currentUser?.id;
  const hasLocalDatabase = typeof indexedDB !== 'undefined';
  const [recovery, setRecovery] = useState<FocusSessionRecovery | null>(null);
  const [recoveryLoaded, setRecoveryLoaded] = useState(false);
  const [state, dispatch] = useReducer(focusReducer, initial);
  const queryClient = useQueryClient();
  const hydratedRef = useRef(false);
  const allowNavigationRef = useRef(false);
  const workLogStartRef = useRef<string | null>(
    recovery?.state.phaseStartedAt &&
      (recovery.state.phase === 'WORK' || recovery.state.previousPhase === 'WORK')
      ? new Date(recovery.state.phaseStartedAt).toISOString()
      : null,
  );
  const syncedDataRef = useRef<SyncPosition>(
    recovery?.synced ?? { logs: 0, rests: 0, completed: 0 },
  );
  const scheduledDataRef = useRef<SyncPosition>(
    recovery?.synced ?? { logs: 0, rests: 0, completed: 0 },
  );
  const updateQueueRef = useRef<Promise<void>>(Promise.resolve());
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (hasLocalDatabase && !userId) {
      if (!isCurrentUserPending) setRecoveryLoaded(true);
      return;
    }
    const load = hasLocalDatabase
      ? findLocalFocusSession(userId as string, taskId, subtaskId).then((record) =>
          record
            ? {
                version: 1 as const,
                state: record.state,
                synced: record.queued,
              }
            : null,
        )
      : readRecovery(getRecoveryKey(taskId, subtaskId));
    void load
      .then((data) => {
        setRecovery(data);
        if (data?.state.phaseStartedAt) {
          if (data.state.phase === 'WORK' || data.state.previousPhase === 'WORK') {
            workLogStartRef.current = new Date(data.state.phaseStartedAt).toISOString();
          }
          syncedDataRef.current = data.synced;
          scheduledDataRef.current = data.synced;
        }
      })
      .catch(() => setRecovery(null))
      .finally(() => setRecoveryLoaded(true));
  }, [
    hasLocalDatabase,
    isCurrentUserPending,
    taskId,
    subtaskId,
    userId,
  ]);

  const allowNavigation = useCallback(() => {
    allowNavigationRef.current = true;
  }, []);
  const finishNavigation = useCallback(() => {
    if (!hasLocalDatabase) {
      void idbClearRecovery(getRecoveryKey(taskId, subtaskId));
    }
    allowNavigation();
  }, [taskId, subtaskId, allowNavigation, hasLocalDatabase]);
  const { mutateAsync: createSession, isPending: isCreatingSession } = useCreateFocusSession();
  const updateSessionMut = useUpdateFocusSession();
  const finaliseSessionMut = useFinaliseFocusSession(taskId, finishNavigation);
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
  const {
    data: recoveredSession,
    error: recoveredSessionError,
    isPending: isRecoveredSessionPending,
    refetch: refetchRecoveredSession,
  } = useReadFocusSession(recovery?.state.sessionId ?? null);
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
    if (hasLocalDatabase && isCurrentUserPending) return;
    if (!recoveryLoaded) return;
    if (isTaskPending || (recovery && isRecoveredSessionPending)) return;
    const error = taskError ?? recoveredSessionError;
    if (error) {
      setHydrationError(error);
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

    if (
      recovery &&
      recoveredSession?.id === recovery.state.sessionId &&
      recoveredSession.end_at === null
    ) {
      dispatch({ type: 'RESTORE_SESSION', state: recovery.state });
      setIsHydrating(false);
      return;
    }

    if (!hasLocalDatabase) {
      void idbClearRecovery(getRecoveryKey(taskId, subtaskId));
    }
    workLogStartRef.current = null;
    syncedDataRef.current = { logs: 0, rests: 0, completed: 0 };
    scheduledDataRef.current = { logs: 0, rests: 0, completed: 0 };

    createSession({ subtask_id: subtaskId, taskId, currentIdx })
      .then((result) => {
        dispatch({
          type: 'CREATE_SESSION',
          sessionId: result.id,
          workCycleM: result.work_cycle_m,
          restCycleM: result.rest_cycle_m,
          currentIdx,
        });
        setIsHydrating(false);
      })
      .catch((error: unknown) => {
        setHydrationError(
          error instanceof Error ? error : new Error('Could not start the focus session.'),
        );
        setIsHydrating(false);
      });
  }, [
    taskId,
    subtaskId,
    subtasks,
    isTaskPending,
    taskError,
    isRecoveredSessionPending,
    recoveredSession,
    recoveredSessionError,
    createSession,
    hydrationAttempt,
    recovery,
    recoveryLoaded,
    hasLocalDatabase,
    isCurrentUserPending,
  ]);

  const retryHydration = useCallback(() => {
    hydratedRef.current = true;
    setHydrationError(null);
    setIsHydrating(true);
    void (async () => {
      const taskResult = await refetchTask();
      if (taskResult.error) {
        setHydrationError(taskResult.error);
        setIsHydrating(false);
        return;
      }
      if (recovery) {
        const sessionResult = await refetchRecoveredSession();
        if (sessionResult.error) {
          setHydrationError(sessionResult.error);
          setIsHydrating(false);
          return;
        }
      }
      hydratedRef.current = false;
      setHydrationAttempt((attempt) => attempt + 1);
    })();
  }, [recovery, refetchRecoveredSession, refetchTask]);

  const enqueueUpdate = useCallback(
    (
      snapshot: State,
      overrides?: Partial<UpdateFocusPayload>,
      options: { terminal?: boolean; finalise?: boolean } = {},
    ): Promise<void> => {
      const sessionId = snapshot.sessionId;
      if (!sessionId) return Promise.resolve();
      const targetPosition = getSyncPosition(snapshot);
      const operation = async () => {
        const payload = buildPendingPayload(snapshot, syncedDataRef.current, overrides);
        const variables = {
          sessionId,
          payload,
          state: snapshot,
          queued: targetPosition,
          terminal: options.terminal,
        };
        if (options.finalise) {
          await finaliseSession(variables);
        } else {
          await updateSession(variables);
        }
        syncedDataRef.current = targetPosition;
        if (!options.terminal && !hasLocalDatabase) {
          await idbWriteRecovery(getRecoveryKey(taskId, subtaskId), {
            version: 1,
            state: stateRef.current,
            synced: targetPosition,
          });
        }
      };
      const queued = updateQueueRef.current.catch(() => undefined).then(operation);
      updateQueueRef.current = queued.catch(() => undefined);
      return queued;
    },
    [
      updateSession,
      finaliseSession,
      taskId,
      subtaskId,
      hasLocalDatabase,
    ],
  );

  useEffect(() => {
    if (!state.sessionId) return;
    if (hasLocalDatabase && userId) {
      void saveLocalFocusState(userId, state.sessionId, state);
      return;
    }
    void idbWriteRecovery(getRecoveryKey(taskId, subtaskId), {
      version: 1,
      state,
      synced: syncedDataRef.current,
    });
  }, [state, taskId, subtaskId, hasLocalDatabase, userId]);

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

  usePreventRemove(Boolean(state.sessionId) || isCreatingSession, ({ data }) => {
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
    enqueueUpdate(
      s,
      { total_overtime_s: s.OTSecondsTotal },
      { terminal: true, finalise: true },
    ).catch(() => {});
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
      await enqueueUpdate(
        nextState,
        { abandon_reason: reason },
        { terminal: true },
      );
      void queryClient.invalidateQueries({ queryKey: ['task', userId] });
      if (!hasLocalDatabase) {
        void idbClearRecovery(getRecoveryKey(taskId, subtaskId));
      }
      allowNavigation();
      router.replace(`/tasks/${taskId}`);
    },
    [
      enqueueUpdate,
      queryClient,
      taskId,
      subtaskId,
      allowNavigation,
      router,
      userId,
      hasLocalDatabase,
    ],
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
