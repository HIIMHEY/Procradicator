import { LogOut } from 'lucide-react-native';

import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { CheckCircleIcon, Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

import { TimerRing } from './TimerRing';

type TimerData = {
  display: string;
  remaining: number;
  isOT: boolean;
  progress: number;
};

type WorkScreenProps = {
  currentSubtask: { title: string; description: string };
  timer: TimerData;
  onComplete: () => void;
  onExit: () => void;
};

export function WorkScreen({ currentSubtask, timer, onComplete, onExit }: WorkScreenProps) {
  const ringColor = timer.isOT ? '#d97706' : '#0060ac';
  const textColor = timer.isOT ? 'text-overtime' : 'text-primary';

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
      <TimerRing progress={timer.progress} color={ringColor}>
        <Box className="flex-col items-center">
          {timer.isOT && (
            <Text className="font-label-sm text-outline uppercase tracking-widest mb-1">
              Overtime
            </Text>
          )}
          <Text
            className={`font-headline-lg text-[72px] leading-none font-extrabold tracking-tighter ${textColor}`}
          >
            {timer.display}
          </Text>
        </Box>
      </TimerRing>
      <Box className="flex-col items-center gap-6 mt-8 w-full">
        <Button
          className="bg-primary flex-row items-center justify-center gap-3 w-full max-w-[280px] py-4 rounded-full"
          onPress={onComplete}
        >
          <Icon as={CheckCircleIcon} className="text-on-primary font-bold" />
          <ButtonText className="font-label-md font-bold uppercase tracking-wide text-on-primary">
            Complete Subtask
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
