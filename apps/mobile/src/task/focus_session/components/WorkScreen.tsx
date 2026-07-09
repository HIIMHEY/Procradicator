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
  currentSubtask: { title: string; description: string };
  timer: TimerData;
  onComplete: () => void;
  onExit: () => void;
};

export function WorkScreen({ currentSubtask, timer, onComplete, onExit }: Props) {
  const ringColor = timer.isOT ? '#F59E0B' : '#000000';

  return (
    <Box className="flex-1 items-center justify-center px-6">
      <Text className="text-lg text-gray-500 mb-1">{currentSubtask.title}</Text>
      <Text className="text-sm text-gray-400 mb-6">{currentSubtask.description}</Text>
      <TimerRing progress={timer.progress} color={ringColor}>
        <Text className="font-headline-lg text-[72px]" style={{ color: ringColor }}>
          {timer.display}
        </Text>
      </TimerRing>
      {timer.isOT && (
        <Text className="text-amber-500 font-medium mt-2">Overtime</Text>
      )}
      <Box className="mt-8 gap-4">
        <Button className="bg-black rounded-full px-8 py-3" onPress={onComplete}>
          <ButtonText className="text-white font-semibold">Complete</ButtonText>
        </Button>
        <Button variant="link" onPress={onExit}>
          <ButtonText className="text-gray-500">Exit</ButtonText>
        </Button>
      </Box>
    </Box>
  );
}
