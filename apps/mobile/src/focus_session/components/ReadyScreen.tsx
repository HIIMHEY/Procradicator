import { LogOut } from 'lucide-react-native';

import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { CheckCircleIcon, Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

import { formatTimer } from '../useTimer';
import { TimerRing } from './TimerRing';

type ReadyScreenProps = {
  currentSubtask: { title: string; description: string };
  workCycleM: number;
  onStart: () => void;
  onExit: () => void;
};

export function ReadyScreen({ currentSubtask, workCycleM, onStart, onExit }: ReadyScreenProps) {
  return (
    <Box className="flex-1 items-center justify-center px-6">
      <Box className="mb-10">
        <Text className="font-headline-md text-primary font-bold mb-2 text-center">
          {currentSubtask.title}
        </Text>
        <Text className="font-body-md text-outline text-center max-w-sm">
          {currentSubtask.description}
        </Text>
      </Box>
      <TimerRing progress={1} color="#0060ac">
        <Text className="font-headline-lg text-[72px] leading-none text-primary font-extrabold tracking-tighter">
          {formatTimer(workCycleM * 60)}
        </Text>
      </TimerRing>
      <Box className="flex-col items-center gap-6 mt-8 w-full">
        <Button
          className="bg-primary flex-row items-center justify-center gap-3 w-full max-w-[280px] py-4 rounded-full"
          onPress={onStart}
        >
          <Icon as={CheckCircleIcon} className="text-on-primary font-bold" />
          <ButtonText className="font-label-md font-bold uppercase tracking-wide text-on-primary">
            Start
          </ButtonText>
        </Button>
        <Button variant="link" className="flex-row items-center gap-2 px-6 py-2" onPress={onExit}>
          <LogOut size={20} color="#717783" />
          <ButtonText className="font-label-md font-medium text-outline">Exit Focus</ButtonText>
        </Button>
      </Box>
    </Box>
  );
}
