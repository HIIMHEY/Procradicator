import { useLocalSearchParams } from 'expo-router';

import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';

import { useFocusSession } from '../hooks/useFocusSession';
import { useTimer } from '../useTimer';
import type { Phase } from '../focusReducer';
import { CongratsScreen } from './CongratsScreen';
import { ExitReasonScreen } from './ExitReasonScreen';
import { ReadyScreen } from './ReadyScreen';
import { RestScreen } from './RestScreen';
import { WorkScreen } from './WorkScreen';

const SCREENS: Record<Phase, 'READY' | 'WORK' | 'REST' | 'CONGRATS' | 'EXIT_REASON'> = {
  READY: 'READY',
  WORK: 'WORK',
  REST: 'REST',
  CONGRATS: 'CONGRATS',
  EXIT_REASON: 'EXIT_REASON',
};

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
    completedIds,
    totalSubtasks,
    isHydrating,
    start,
    completeSubtask,
    skipRest,
    requestExit,
    finalise,
    abandon,
    closeExitReason,
  } = useFocusSession(subtaskId, taskId);

  const phaseDurationM = phase === 'REST' ? restCycleM : workCycleM;
  const timer = useTimer(phaseStartedAt, phaseDurationM);

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

  const screen = SCREENS[phase];

  if (screen === 'READY') {
    return (
      <ReadyScreen
        currentSubtask={
          currentSubtask ?? { title: 'Focus', description: 'Start your work' }
        }
        onStart={start}
        onExit={requestExit}
      />
    );
  }

  if (screen === 'WORK') {
    return (
      <WorkScreen
        currentSubtask={
          currentSubtask ?? { title: 'Focus', description: 'Continue working' }
        }
        timer={{
          ...timer,
          isOT: timer.isOT || isOT,
        }}
        onComplete={completeSubtask}
        onExit={requestExit}
      />
    );
  }

  if (screen === 'REST') {
    return (
      <RestScreen
        timer={timer}
        onSkip={skipRest}
      />
    );
  }

  if (screen === 'CONGRATS') {
    return (
      <CongratsScreen
        completedIds={completedIds.length}
        totalSubtasks={totalSubtasks}
        onFinish={finalise}
        isPending={false}
      />
    );
  }

  if (screen === 'EXIT_REASON') {
    return (
      <ExitReasonScreen
        onSubmit={abandon}
        onClose={closeExitReason}
        isPending={false}
      />
    );
  }

  return null;
}
