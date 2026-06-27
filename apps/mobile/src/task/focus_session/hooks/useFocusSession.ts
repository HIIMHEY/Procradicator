import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { startFocusSession, updateFocusSession } from '../api';
import type { AbandonFocusSessionData, FocusSession, FocusSessionAction } from '../schemas';
import { AbandonFocusSessionSchema } from '../schemas';
import { formatTimer, getSessionRemainingSeconds, getTimerMode, isTimedFocusState } from '../utils';

type FocusSessionActionVariables = {
  sessionId: string;
  taskId: string;
  action: FocusSessionAction;
  payload?: AbandonFocusSessionData;
};

type UseFocusSessionResult = {
  abandonReason: string;
  actionErrorMessage: string | null;
  closeExitForm: () => void;
  focusSession: FocusSession | null;
  formattedTimer: string;
  giveUp: () => void;
  isAbandoningSession: boolean;
  isCompletingTransition: boolean;
  isExitModalOpen: boolean;
  isRecordingExitAttempt: boolean;
  isResumingSession: boolean;
  isStartingSession: boolean;
  reasonError: string;
  requestExit: () => void;
  setAbandonReason: (value: string) => void;
  startNextWork: () => void;
  startRest: () => void;
  startSessionError: Error | null;
  timerMode: 'work' | 'rest';
};

export default function useFocusSession(subtaskId: string): UseFocusSessionResult {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [focusSession, setFocusSession] = useState<FocusSession | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [hasStartedSession, setHasStartedSession] = useState(false);
  const [hasRequestedCompletion, setHasRequestedCompletion] = useState(false);
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);
  const [abandonReason, setAbandonReasonValue] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [pendingAction, setPendingAction] = useState<FocusSessionAction | null>(null);

  const applySession = useCallback((session: FocusSession): void => {
    setFocusSession(session);
    setRemainingSeconds(getSessionRemainingSeconds(session));
    setHasRequestedCompletion(false);
  }, []);

  const startSessionMutation = useMutation({
    mutationFn: startFocusSession,
  });

  const actionMutation = useMutation({
    mutationFn: ({ sessionId, action, payload }: FocusSessionActionVariables) =>
      updateFocusSession(sessionId, action, payload),
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['focus-session', variables.sessionId] });
      queryClient.invalidateQueries({ queryKey: ['focus-session', 'active'] });
      queryClient.invalidateQueries({ queryKey: ['task', variables.taskId] });
      queryClient.invalidateQueries({ queryKey: ['task', 'task-list'] });
    },
  });

  const runAction = useCallback(
    (
      action: FocusSessionAction,
      payload?: AbandonFocusSessionData,
      onSuccess?: (updatedSession: FocusSession) => void,
    ): void => {
      if (!focusSession) {
        return;
      }
      setPendingAction(action);
      actionMutation.mutate(
        {
          sessionId: focusSession.id,
          taskId: focusSession.task_id,
          action,
          payload,
        },
        {
          onSuccess,
          onSettled: () => {
            setPendingAction(null);
          },
        },
      );
    },
    [actionMutation, focusSession],
  );

  useEffect(() => {
    if (!subtaskId || hasStartedSession) {
      return;
    }
    setHasStartedSession(true);
    startSessionMutation.mutate(
      { subtask_id: subtaskId },
      {
        onSuccess: applySession,
      },
    );
  }, [applySession, hasStartedSession, startSessionMutation, subtaskId]);

  useEffect(() => {
    if (!focusSession || !isTimedFocusState(focusSession.state)) {
      return;
    }
    const intervalId = globalThis.setInterval(() => {
      setRemainingSeconds((currentSeconds) => Math.max(0, currentSeconds - 1));
    }, 1000);
    return () => {
      globalThis.clearInterval(intervalId);
    };
  }, [focusSession]);

  useEffect(() => {
    if (!focusSession || remainingSeconds !== 0 || hasRequestedCompletion) {
      return;
    }
    if (focusSession.state === 'WORKING') {
      setHasRequestedCompletion(true);
      runAction('complete_work', undefined, applySession);
      return;
    }
    if (focusSession.state === 'RESTING') {
      setHasRequestedCompletion(true);
      runAction('complete_rest', undefined, (updatedSession) => {
        applySession(updatedSession);
        if (updatedSession.state === 'COMPLETED') {
          router.navigate(`/tasks/${updatedSession.task_id}`);
        }
      });
    }
  }, [applySession, focusSession, hasRequestedCompletion, remainingSeconds, router, runAction]);

  const requestExit = (): void => {
    runAction('exit_attempt', undefined, (updatedSession) => {
      applySession(updatedSession);
      setIsExitModalOpen(true);
    });
  };

  const closeExitForm = (): void => {
    setIsExitModalOpen(false);
    setReasonError('');
  };

  const setAbandonReason = (value: string): void => {
    setAbandonReasonValue(value);
    if (value.trim()) {
      setReasonError('');
    }
  };

  const startRest = (): void => {
    runAction('start_rest', undefined, applySession);
  };

  const startNextWork = (): void => {
    runAction('resume', undefined, applySession);
  };

  const giveUp = (): void => {
    const result = AbandonFocusSessionSchema.safeParse({ reason: abandonReason });
    if (!result.success) {
      setReasonError(result.error.issues[0]?.message ?? 'Reason is required');
      return;
    }
    setReasonError('');
    runAction('abandon', result.data, (updatedSession) => {
      router.navigate(`/tasks/${updatedSession.task_id}`);
    });
  };

  const actionErrorMessage =
    actionMutation.error instanceof Error ? actionMutation.error.message : null;
  const formattedTimer = useMemo(() => formatTimer(remainingSeconds), [remainingSeconds]);
  const timerMode = focusSession ? getTimerMode(focusSession.state) : 'work';

  return {
    abandonReason,
    actionErrorMessage,
    closeExitForm,
    focusSession,
    formattedTimer,
    giveUp,
    isAbandoningSession: pendingAction === 'abandon' && actionMutation.isPending,
    isCompletingTransition:
      actionMutation.isPending &&
      (pendingAction === 'complete_work' ||
        pendingAction === 'start_rest' ||
        pendingAction === 'complete_rest'),
    isExitModalOpen,
    isRecordingExitAttempt: pendingAction === 'exit_attempt' && actionMutation.isPending,
    isResumingSession: pendingAction === 'resume' && actionMutation.isPending,
    isStartingSession: startSessionMutation.isPending,
    reasonError,
    requestExit,
    setAbandonReason,
    startNextWork,
    startRest,
    startSessionError:
      startSessionMutation.error instanceof Error ? startSessionMutation.error : null,
    timerMode,
  };
}
