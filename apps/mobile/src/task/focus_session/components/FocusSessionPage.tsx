import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import useFocusSession from '../hooks/useFocusSession';
import { getSearchParam } from '../utils';
import { ExitModal } from './ExitModal';

export function FocusSessionPage() {
  const searchParams = useLocalSearchParams<{
    id?: string | string[];
  }>();

  const subtaskId = getSearchParam(searchParams.id);

  const {
    abandonReason,
    actionErrorMessage,
    closeExitForm,
    focusSession,
    formattedTimer,
    giveUp,
    isAbandoningSession,
    isCompletingTransition,
    isExitModalOpen,
    isRecordingExitAttempt,
    isResumingSession,
    isStartingSession,
    reasonError,
    requestExit,
    setAbandonReason,
    startNextWork,
    startRest,
    startSessionError,
    timerMode,
  } = useFocusSession(subtaskId);

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
        {isStartingSession && <Spinner size="large" />}

        {startSessionError && (
          <Text className="mt-4 text-center text-base text-red-600">
            {startSessionError.message}
          </Text>
        )}
      </Box>
    );
  }

  const showMainContent = !isExitModalOpen;

  return (
    <Box className={`flex-1 items-center bg-white px-6 ${isExitModalOpen ? 'pt-28' : 'pt-36'}`}>
      {isExitModalOpen && (
        <Button
          accessibilityLabel="Close exit form"
          variant="link"
          className="absolute left-6 top-6 h-14 w-14 items-center justify-center rounded-full bg-transparent p-0"
          onPress={closeExitForm}
        >
          <Icon as={ArrowLeft} className="text-black" size="xl" />
        </Button>
      )}

      <Text className="text-5xl font-bold text-black">{formattedTimer}</Text>

      {isExitModalOpen && (
        <ExitModal
          abandonReason={abandonReason}
          setAbandonReason={setAbandonReason}
          reasonError={reasonError}
          actionErrorMessage={actionErrorMessage}
          isAbandoningSession={isAbandoningSession}
          giveUp={giveUp}
          timerMode={timerMode}
        />
      )}

      {showMainContent && (
        <Box className="mt-8 h-36 w-36 items-center justify-center rounded-full border-2 border-black px-4">
          <Text className="text-center text-base leading-5 text-black">{timerMode}</Text>
        </Box>
      )}

      {showMainContent && <Text className="mt-6 text-lg text-black">work : rest</Text>}

      {showMainContent && (
        <Text className="mt-1 text-2xl font-bold text-black">
          {focusSession.work_duration_minutes}:{focusSession.rest_duration_minutes}
        </Text>
      )}

      {showMainContent && (
        <Text className="mt-8 text-center text-2xl font-bold text-black">
          {focusSession.current_subtask?.title ?? 'Focus session'}
        </Text>
      )}

      {showMainContent && (
        <Text className="mt-3 max-w-xl text-center text-base text-slate-600">
          {focusSession.current_subtask?.description ?? ''}
        </Text>
      )}

      {showMainContent && actionErrorMessage && (
        <Text className="mt-4 text-center text-sm text-red-600">{actionErrorMessage}</Text>
      )}

      {showMainContent && (
        <Box className="absolute bottom-10 left-0 right-0 items-center px-6 w-full">
          {focusSession.state === 'WORK_COMPLETE' && (
            <Box className="flex-row gap-4 w-full max-w-sm justify-center">
              <Button
                className="h-16 flex-1 rounded-none bg-black"
                isDisabled={isCompletingTransition}
                onPress={startRest}
              >
                {isCompletingTransition ? (
                  <Spinner />
                ) : (
                  <ButtonText className="text-white">Start Rest</ButtonText>
                )}
              </Button>
            </Box>
          )}

          {focusSession.state === 'REST_COMPLETE' && (
            <Box className="flex-row gap-4 w-full max-w-sm justify-center">
              <Button
                className="h-16 flex-1 rounded-none bg-black"
                isDisabled={isResumingSession}
                onPress={startNextWork}
              >
                {isResumingSession ? (
                  <Spinner />
                ) : (
                  <ButtonText className="text-white">Start Work</ButtonText>
                )}
              </Button>
            </Box>
          )}

          {focusSession.state !== 'WORK_COMPLETE' && focusSession.state !== 'REST_COMPLETE' && (
            <Button
              accessibilityLabel="Exit focus session"
              variant="link"
              className="h-16 w-24 items-center justify-center rounded-full bg-transparent p-0"
              isDisabled={isRecordingExitAttempt || isCompletingTransition}
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
      )}
    </Box>
  );
}
