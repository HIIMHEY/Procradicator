import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { Textarea, TextareaInput } from '@/components/ui/textarea';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import useAbandonFocusSession from '../hooks/useAbandonFocusSession';
import useCompleteFocusRest from '../hooks/useCompleteFocusRest';
import useCompleteFocusWork from '../hooks/useCompleteFocusWork';
import useRecordExitAttempt from '../hooks/useRecordExitAttempt';
import useResumeFocusSession from '../hooks/useResumeFocusSession';
import useStartFocusSession from '../hooks/useStartFocusSession';
import type { FocusSession } from '../schemas';

type FocusStage = 'WORK' | 'WORK_COMPLETE' | 'REST' | 'REST_COMPLETE';

const getSearchParam = (value: string | string[] | undefined): string => {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  return value ?? '';
};

const formatTimer = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => value.toString().padStart(2, '0')).join(':');
};

const calculateRemainingSeconds = (
  durationMinutes: number,
  phaseStartedAt: string | null,
): number => {
  const durationSeconds = durationMinutes * 60;
  if (!phaseStartedAt) {
    return durationSeconds;
  }
  const elapsedSeconds = Math.floor((Date.now() - new Date(phaseStartedAt).getTime()) / 1000);
  return Math.max(0, Math.min(durationSeconds, durationSeconds - elapsedSeconds));
};

export function FocusSessionPage() {
  const searchParams = useLocalSearchParams<{
    id?: string | string[];
  }>();
  const router = useRouter();
  const subtaskId = getSearchParam(searchParams.id);
  const [focusSession, setFocusSession] = useState<FocusSession | null>(null);
  const [focusStage, setFocusStage] = useState<FocusStage>('WORK');
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [hasStartedSession, setHasStartedSession] = useState(false);
  const [hasRequestedCompletion, setHasRequestedCompletion] = useState(false);
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);
  const [abandonReason, setAbandonReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const {
    mutate: startFocusSession,
    isPending: isStartingSession,
    error: startSessionError,
  } = useStartFocusSession();
  const sessionId = focusSession?.id ?? '';
  const taskId = focusSession?.task_id ?? '';
  const {
    mutate: recordExitAttempt,
    isPending: isRecordingExitAttempt,
    error: exitAttemptError,
  } = useRecordExitAttempt(sessionId, taskId);
  const {
    mutate: completeFocusWork,
    isPending: isCompletingWork,
    error: completeWorkError,
  } = useCompleteFocusWork(sessionId, taskId);
  const {
    mutate: completeFocusRest,
    isPending: isCompletingRest,
    error: completeRestError,
  } = useCompleteFocusRest(sessionId, taskId);
  const {
    mutate: resumeFocusSession,
    isPending: isResumingSession,
    error: resumeSessionError,
  } = useResumeFocusSession(sessionId, taskId);
  const {
    mutate: abandonFocusSession,
    isPending: isAbandoningSession,
    error: abandonSessionError,
  } = useAbandonFocusSession(sessionId, taskId);
  useEffect(() => {
    if (!subtaskId || hasStartedSession) {
      return;
    }
    setHasStartedSession(true);
    startFocusSession(subtaskId, {
      onSuccess: (startedSession) => {
        setFocusSession(startedSession);
        setHasRequestedCompletion(false);
        if (
          startedSession.status === 'RESTING' &&
          startedSession.mode === 'REST' &&
          startedSession.phase_started_at === null
        ) {
          setFocusStage('REST_COMPLETE');
          setRemainingSeconds(0);
          return;
        }
        if (startedSession.status === 'RESTING' || startedSession.mode === 'REST') {
          setFocusStage('REST');
          setRemainingSeconds(
            calculateRemainingSeconds(
              startedSession.rest_duration_minutes,
              startedSession.phase_started_at,
            ),
          );
          return;
        }
        setFocusStage('WORK');
        setRemainingSeconds(
          calculateRemainingSeconds(
            startedSession.work_duration_minutes,
            startedSession.phase_started_at,
          ),
        );
      },
    });
  }, [hasStartedSession, startFocusSession, subtaskId]);
  useEffect(() => {
    if (!focusSession || (focusStage !== 'WORK' && focusStage !== 'REST')) {
      return;
    }
    const intervalId = globalThis.setInterval(() => {
      setRemainingSeconds((currentSeconds) => Math.max(0, currentSeconds - 1));
    }, 1000);
    return () => {
      globalThis.clearInterval(intervalId);
    };
  }, [focusSession, focusStage]);
  useEffect(() => {
    if (!focusSession || remainingSeconds !== 0 || hasRequestedCompletion) {
      return;
    }
    if (focusStage === 'WORK') {
      setHasRequestedCompletion(true);
      completeFocusWork(undefined, {
        onSuccess: (updatedSession) => {
          setFocusSession(updatedSession);
          setFocusStage('WORK_COMPLETE');
        },
      });
      return;
    }
    if (focusStage === 'REST') {
      setHasRequestedCompletion(true);
      completeFocusRest(undefined, {
        onSuccess: (updatedSession) => {
          setFocusSession(updatedSession);
          if (updatedSession.status === 'COMPLETED') {
            router.navigate(`/tasks/${updatedSession.task_id}`);
            return;
          }
          setFocusStage('REST_COMPLETE');
        },
      });
    }
  }, [
    completeFocusRest,
    completeFocusWork,
    focusSession,
    focusStage,
    hasRequestedCompletion,
    remainingSeconds,
    router,
  ]);
  const formattedTimer = useMemo(() => formatTimer(remainingSeconds), [remainingSeconds]);
  const timerMode = focusStage === 'WORK' || focusStage === 'WORK_COMPLETE' ? 'work' : 'rest';
  const requestExit = (): void => {
    recordExitAttempt(undefined, {
      onSuccess: () => {
        setIsExitModalOpen(true);
      },
    });
  };
  const startRest = (): void => {
    if (!focusSession) {
      return;
    }
    setFocusStage('REST');
    setRemainingSeconds(focusSession.rest_duration_minutes * 60);
    setHasRequestedCompletion(false);
  };
  const startNextWork = (): void => {
    resumeFocusSession(undefined, {
      onSuccess: (updatedSession) => {
        setFocusSession(updatedSession);
        setFocusStage('WORK');
        setRemainingSeconds(updatedSession.work_duration_minutes * 60);
        setHasRequestedCompletion(false);
      },
    });
  };
  const giveUp = (): void => {
    const cleanedReason = abandonReason.trim();
    if (!cleanedReason) {
      setReasonError('Reason is required');
      return;
    }
    setReasonError('');
    abandonFocusSession(
      { reason: cleanedReason },
      {
        onSuccess: (updatedSession) => {
          router.navigate(`/tasks/${updatedSession.task_id}`);
        },
      },
    );
  };
  const actionError =
    exitAttemptError ??
    completeWorkError ??
    completeRestError ??
    resumeSessionError ??
    abandonSessionError;
  const actionErrorMessage = actionError instanceof Error ? actionError.message : null;
  if (!subtaskId) {
    return (
      <Box className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-center text-base text-red-600">
          Focus session subtask is missing.
        </Text>
      </Box>
    );
  }
  if (!focusSession) {
    return (
      <Box className="flex-1 items-center justify-center bg-white px-6">
        {isStartingSession ? <Spinner size="large" /> : null}

        {startSessionError ? (
          <Text className="mt-4 text-center text-base text-red-600">
            {startSessionError.message}
          </Text>
        ) : null}
      </Box>
    );
  }
  return (
    <Box className="flex-1 items-center bg-white px-6 pt-16">
      {isExitModalOpen ? (
        <Button
          accessibilityLabel="Close exit form"
          variant="link"
          className="absolute left-6 top-6 h-14 w-14 items-center justify-center rounded-full bg-transparent p-0"
          onPress={() => {
            setIsExitModalOpen(false);
            setReasonError('');
          }}
        >
          <Icon as={ArrowLeft} className="text-black" size="xl" />
        </Button>
      ) : null}

      <Text className="text-5xl font-bold text-black">{formattedTimer}</Text>

      <Box className="mt-8 h-36 w-36 items-center justify-center rounded-full border-2 border-black px-4">
        <Text className="text-center text-base leading-5 text-black">
          {timerMode}
          {'\n'}
          {formattedTimer}
        </Text>
      </Box>

      <Text className="mt-6 text-lg text-black">work : rest</Text>

      <Text className="mt-1 text-2xl font-bold text-black">
        {focusSession.work_duration_minutes}:{focusSession.rest_duration_minutes}
      </Text>

      {isExitModalOpen ? (
        <Box className="mt-8 w-full max-w-[270px] border-2 border-black bg-white p-4">
          <Text className="text-center text-base leading-6 text-black">
            {'Question / text\nencouraging user to\nwork'}
          </Text>

          <Textarea className="mt-3 min-h-44 rounded-md border border-slate-200 bg-white">
            <TextareaInput
              placeholder="Textbox Input Field"
              value={abandonReason}
              onChangeText={(value) => {
                setAbandonReason(value);
                if (value.trim()) {
                  setReasonError('');
                }
              }}
            />
          </Textarea>

          {reasonError ? <Text className="mt-2 text-sm text-red-600">{reasonError}</Text> : null}

          {abandonSessionError ? (
            <Text className="mt-2 text-sm text-red-600">{abandonSessionError.message}</Text>
          ) : null}

          <Box className="mt-2 items-end">
            <Button
              className="rounded-md bg-black px-5"
              isDisabled={isAbandoningSession}
              onPress={giveUp}
            >
              {isAbandoningSession ? <Spinner /> : <ButtonText>Give up?</ButtonText>}
            </Button>
          </Box>
        </Box>
      ) : (
        <>
          <Text className="mt-8 text-center text-2xl font-bold text-black">
            {focusSession.current_subtask?.title ?? 'Focus session'}
          </Text>

          <Text className="mt-3 max-w-xl text-center text-base text-slate-600">
            {focusSession.current_subtask?.description ?? ''}
          </Text>

          {actionErrorMessage ? (
            <Text className="mt-4 text-center text-sm text-red-600">{actionErrorMessage}</Text>
          ) : null}

          <Box className="absolute bottom-10 left-0 right-0 items-center">
            {focusStage === 'WORK_COMPLETE' ? (
              <Button className="h-16 rounded-none bg-black px-12" onPress={startRest}>
                <ButtonText>Done</ButtonText>
              </Button>
            ) : focusStage === 'REST_COMPLETE' ? (
              <Button
                className="h-16 rounded-none bg-black px-12"
                isDisabled={isResumingSession}
                onPress={startNextWork}
              >
                {isResumingSession ? <Spinner /> : <ButtonText>Start</ButtonText>}
              </Button>
            ) : (
              <Button
                accessibilityLabel="Exit focus session"
                variant="link"
                className="h-16 w-24 items-center justify-center rounded-full bg-transparent p-0"
                isDisabled={isRecordingExitAttempt || isCompletingWork || isCompletingRest}
                onPress={requestExit}
              >
                {isRecordingExitAttempt ? (
                  <Spinner />
                ) : (
                  <Icon as={ArrowLeft} className="text-black" size="xl" />
                )}
              </Button>
            )}
          </Box>
        </>
      )}
    </Box>
  );
}
