import { type JSX, useEffect } from 'react';
import { useLocalSearchParams } from 'expo-router';

import { Box } from '@/components/ui/box';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { ErrorFallback } from '@/task/components/ErrorFallback';

import { useFocusSession } from '../hooks/useFocusSession';
import { useTimer } from '../useTimer';
import type { Phase } from '../focusReducer';
import { CongratsScreen } from './CongratsScreen';
import { ExitReasonScreen } from './ExitReasonScreen';
import { ReadyScreen } from './ReadyScreen';
import { RestScreen } from './RestScreen';
import { WorkScreen } from './WorkScreen';

export function FocusSessionPage() {
  const params = useLocalSearchParams<{ id?: string; taskId?: string }>();
  const subtaskId = params.id ?? '';
  const taskId = params.taskId ?? '';

  const {
    phase,
    isOT,
    phaseStartedAt,
    workCycleM,
    restCycleM,
    currentSubtask,
    totalFocusTimeS,
    isHydrating,
    hydrationError,
    retryHydration,
    isFinishing,
    start,
    completeSubtask,
    enterOT,
    skipRest,
    completeRest,
    requestExit,
    finalise,
    abandon,
    closeExitReason,
  } = useFocusSession(subtaskId, taskId);

  const phaseDurationM = phase === 'REST' ? restCycleM : workCycleM;
  const timer = useTimer(phaseStartedAt, phaseDurationM);

  useEffect(() => {
    if (phase === 'WORK' && timer.isOT && !isOT) {
      enterOT();
    }
  }, [phase, timer.isOT, isOT, enterOT]);

  useEffect(() => {
    if (phase === 'REST' && timer.isOT) {
      completeRest();
    }
  }, [phase, timer.isOT, completeRest]);

  if (!subtaskId) {
    return (
      <Text className="text-center text-base text-red-600 mt-20">
        Focus session subtask is missing.
      </Text>
    );
  }

  if (isHydrating) {
    return <Spinner size="large" className="mt-20" />;
  }

  if (hydrationError) {
    return <ErrorFallback message={hydrationError.message} onRetry={retryHydration} />;
  }

  const subtask = currentSubtask ?? { title: 'Focus', description: 'Start your work' };

  const SCREEN: Record<Phase, JSX.Element> = {
    READY: (
      <ReadyScreen
        currentSubtask={subtask}
        workCycleM={workCycleM}
        onStart={start}
        onExit={requestExit}
      />
    ),
    WORK: (
      <WorkScreen
        currentSubtask={subtask}
        timer={{ ...timer, isOT: timer.isOT || isOT }}
        onComplete={() => completeSubtask(Math.abs(Math.min(0, timer.remaining)))}
        onExit={requestExit}
      />
    ),
    REST: <RestScreen timer={timer} onSkip={skipRest} />,
    CONGRATS: (
      <CongratsScreen
        focusTimeM={Math.round(totalFocusTimeS / 60)}
        onFinish={finalise}
        isPending={isFinishing}
      />
    ),
    EXIT_REASON: <ExitReasonScreen onSubmit={abandon} onClose={closeExitReason} />,
  };

  return <Box className="flex-1 bg-background">{SCREEN[phase]}</Box>;
}
