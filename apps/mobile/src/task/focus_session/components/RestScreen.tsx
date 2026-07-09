import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

import { TimerRing } from './TimerRing';

type TimerData = {
  display: string;
  remaining: number;
  isOT: boolean;
  progress: number;
};

type Props = {
  timer: TimerData;
  onSkip: () => void;
};

export function RestScreen({ timer, onSkip }: Props) {
  return (
    <Box className="flex-1 items-center justify-center px-6">
      <Text className="text-lg text-gray-500 mb-6">Rest Well</Text>
      <TimerRing progress={timer.progress} color="#10B981">
        <Text className="font-headline-lg text-[72px] text-black">
          {timer.display}
        </Text>
      </TimerRing>
      <Box className="mt-8">
        <Button className="bg-black rounded-full px-8 py-3" onPress={onSkip}>
          <ButtonText className="text-white font-semibold">Skip</ButtonText>
        </Button>
      </Box>
    </Box>
  );
}
