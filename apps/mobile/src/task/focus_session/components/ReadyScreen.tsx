import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { PlayIcon, Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

import { TimerRing } from './TimerRing';

type Props = {
  currentSubtask: { title: string; description: string };
  onStart: () => void;
  onExit: () => void;
};

export function ReadyScreen({ currentSubtask, onStart, onExit }: Props) {
  return (
    <Box className="flex-1 items-center justify-center px-6">
      <Text className="text-lg text-gray-500 mb-1">{currentSubtask.title}</Text>
      <Text className="text-sm text-gray-400 mb-6">{currentSubtask.description}</Text>
      <TimerRing progress={1} color="#000000">
        <Text className="font-headline-lg text-[72px] text-black">Ready</Text>
      </TimerRing>
      <Box className="mt-8 gap-4">
        <Button className="bg-black rounded-full px-8 py-3" onPress={onStart}>
          <Icon as={PlayIcon} className="text-white mr-2" />
          <ButtonText className="text-white font-semibold">Start</ButtonText>
        </Button>
        <Button variant="link" onPress={onExit}>
          <ButtonText className="text-gray-500">Exit</ButtonText>
        </Button>
      </Box>
    </Box>
  );
}
