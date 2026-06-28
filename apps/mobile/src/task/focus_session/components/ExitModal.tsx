import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { Textarea, TextareaInput } from '@/components/ui/textarea';
import {
  FormControl,
  FormControlError,
  FormControlErrorText,
  FormControlLabel,
  FormControlLabelText,
} from '@/components/ui/form-control';
import { LogOut } from 'lucide-react-native';

interface ExitModalProps {
  abandonReason: string;
  setAbandonReason: (reason: string) => void;
  reasonError: string | null;
  actionErrorMessage: string | null;
  isAbandoningSession: boolean;
  giveUp: () => void;
  timerMode: 'work' | 'rest'; // Added prop
}

export function ExitModal({
  abandonReason,
  setAbandonReason,
  reasonError,
  actionErrorMessage,
  isAbandoningSession,
  giveUp,
  timerMode,
}: ExitModalProps) {
  const isInvalid = !!reasonError;

  const labelText =
    timerMode === 'work'
      ? 'Giving up so soon? At least tell yourself why?'
      : 'Ending your break early? Tell yourself why you are skipping rest?';

  return (
    <Box className="relative mt-10 w-full max-w-[270px] items-center">
      <Box className="absolute -top-3 h-20 w-20 rounded-full border-2 border-black bg-white" />

      <Box className="z-10 w-full border-2 rounded-sm border-black bg-white p-4">
        <FormControl isInvalid={isInvalid} size="md" className="w-full">
          <FormControlLabel className="mb-2">
            <FormControlLabelText className="text-center text-base leading-6 text-black font-normal">
              {labelText}
            </FormControlLabelText>
          </FormControlLabel>

          <Textarea className="mt-1 min-h-44 rounded-md border border-slate-200 bg-white">
            <TextareaInput
              placeholder="Why do you have to go?"
              value={abandonReason}
              onChangeText={setAbandonReason}
              className="text-black"
              multiline
            />
          </Textarea>

          <FormControlError className="mt-2">
            <FormControlErrorText className="text-sm text-red-600">
              {reasonError}
            </FormControlErrorText>
          </FormControlError>
        </FormControl>

        {actionErrorMessage && (
          <Text className="mt-2 text-sm text-red-600">{actionErrorMessage}</Text>
        )}

        <Box className="mt-4 items-end">
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
  );
}
