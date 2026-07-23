import { SkipForward } from 'lucide-react-native';

import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

import { TimerRing } from './TimerRing';

type TimerData = {
  display: string;
  remaining: number;
  isOT: boolean;
  progress: number;
};

type RestScreenProps = {
  timer: TimerData;
  onSkip: () => void;
};

export function RestScreen({ timer, onSkip }: RestScreenProps) {
  return (
    <Box className="flex-1 items-center justify-center px-6">
      <Text className="font-headline-md text-primary font-bold mb-2 text-center">Rest Well</Text>
      <TimerRing progress={timer.progress} color="#0060ac">
        <Text className="font-headline-lg text-[72px] leading-none text-primary font-extrabold tracking-tighter">
          {timer.display}
        </Text>
      </TimerRing>
      <Box className="flex-col items-center gap-6 mt-8 w-full">
        <Button
          className="bg-primary flex-row items-center justify-center gap-3 w-full max-w-[280px] py-4 rounded-full"
          onPress={onSkip}
        >
          <Icon as={SkipForward} className="text-on-primary font-bold" />
          <ButtonText className="font-label-md font-bold uppercase tracking-wide text-on-primary">
            Skip
          </ButtonText>
        </Button>
      </Box>
    </Box>
  );
}
