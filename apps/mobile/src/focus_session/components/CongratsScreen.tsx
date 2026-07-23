import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { CheckCircleIcon, Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';

type CongratsScreenProps = {
  focusTimeM: number;
  onFinish: () => void;
  isPending?: boolean;
};

export function CongratsScreen({ focusTimeM, onFinish, isPending }: CongratsScreenProps) {
  return (
    <Box className="flex-1 items-center justify-center px-6">
      <Box className="w-32 h-32 bg-surface-container-high rounded-full items-center justify-center">
        <Icon as={CheckCircleIcon} className="text-primary w-20 h-20" />
      </Box>
      <Box className="mt-8 mb-8 items-center">
        <Text className="font-headline-lg text-on-surface text-center mb-3">
          Well done! You&apos;ve made progress.
        </Text>
      </Box>
      <Box className="bg-surface-container-low p-6 rounded-2xl items-center w-full max-w-xs">
        <Text className="font-label-sm text-on-surface-variant uppercase tracking-wide mb-1">
          Focus Time
        </Text>
        <Box className="flex-row items-baseline gap-1">
          <Text className="font-headline-md text-primary font-bold">{focusTimeM}</Text>
          <Text className="font-label-md text-on-surface-variant">MINUTES</Text>
        </Box>
      </Box>
      <Box className="mt-8 w-full items-center">
        <Button
          className="bg-surface-container-high flex-row items-center justify-center gap-2 py-4 px-8 rounded-full w-full max-w-xs"
          isDisabled={isPending}
          onPress={onFinish}
        >
          {isPending ? (
            <Spinner size="small" color="white" />
          ) : (
            <Icon as={CheckCircleIcon} className="text-on-surface" />
          )}
          <ButtonText className="font-label-md text-on-surface">Finish Task</ButtonText>
        </Button>
      </Box>
    </Box>
  );
}
