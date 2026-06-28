import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { Textarea, TextareaInput } from '@/components/ui/textarea';
import { useLocalSearchParams } from 'expo-router';
import { ArrowLeft, LogOut } from 'lucide-react-native';
import useFocusSession from '../hooks/useFocusSession';
import { getSearchParam } from '../utils';

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
    <Box className={`flex-1 items-center bg-white px-6 ${isExitModalOpen ? 'pt-28' : 'pt-36'}`}>
      {isExitModalOpen ? (
        <Button
          accessibilityLabel="Close exit form"
          variant="link"
          className="absolute left-6 top-6 h-14 w-14 items-center justify-center rounded-full bg-transparent p-0"
          onPress={closeExitForm}
        >
          <Icon as={ArrowLeft} className="text-black" size="xl" />
        </Button>
      ) : null}

      <Text className="text-5xl font-bold text-black">{formattedTimer}</Text>

      {isExitModalOpen ? (
        <Box className="relative mt-10 w-full max-w-[270px] items-center">
          <Box className="absolute -top-3 h-20 w-20 rounded-full border-2 border-black bg-white" />

          <Box className="z-10 w-full border-2 border-black bg-white p-4">
            <Text className="text-center text-base leading-6 text-black">
              {'Question / text\nencouraging user to\nwork'}
            </Text>

            <Textarea className="mt-3 min-h-44 rounded-md border border-slate-200 bg-white">
              <TextareaInput
                placeholder="Textbox Input Field"
                value={abandonReason}
                onChangeText={setAbandonReason}
                className="text-black"
              />
            </Textarea>

            {reasonError ? <Text className="mt-2 text-sm text-red-600">{reasonError}</Text> : null}

            {actionErrorMessage ? (
              <Text className="mt-2 text-sm text-red-600">{actionErrorMessage}</Text>
            ) : null}

            <Box className="mt-2 items-end">
              <Button
                className="flex-row items-center gap-1 rounded-md bg-black px-4"
                isDisabled={isAbandoningSession}
                onPress={giveUp}
              >
                {isAbandoningSession ? (
                  <Spinner />
                ) : (
                  <>
                    <Icon as={LogOut} className="text-white" size="xs" />
                    <ButtonText className="text-white">Give up?</ButtonText>
                  </>
                )}
              </Button>
            </Box>
          </Box>
        </Box>
      ) : (
        <>
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
            {focusSession.state === 'WORK_COMPLETE' ? (
              <Button
                className="h-16 rounded-none bg-black px-12"
                isDisabled={isCompletingTransition}
                onPress={startRest}
              >
                {isCompletingTransition ? <Spinner /> : <ButtonText>Done</ButtonText>}
              </Button>
            ) : focusSession.state === 'REST_COMPLETE' ? (
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
        </>
      )}
    </Box>
  );
}
