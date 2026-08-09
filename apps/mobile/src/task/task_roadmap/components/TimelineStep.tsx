import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { CheckIcon, ClockIcon, Icon, LockIcon, PlayIcon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useRouter } from 'expo-router';
import { Subtask } from '../../schema';
import { formatEstimate } from '../../utils';

export type TimelineStatus = 'completed' | 'in_progress' | 'locked';

interface TimelineStepProps {
  data: Subtask;
  status: TimelineStatus;
  isLast: boolean;
  taskId: string;
}

function TimelineNode({ status }: { status: TimelineStatus }) {
  if (status === 'completed') {
    return (
      <Box className="w-10 h-10 rounded-full items-center justify-center bg-[#3B59B6]">
        <Icon as={CheckIcon} className="text-white" size="md" />
      </Box>
    );
  }
  if (status === 'in_progress') {
    return (
      <Box className="w-10 h-10 rounded-full items-center justify-center bg-[#3B59B6]">
        <Icon as={PlayIcon} className="text-white" size="md" />
      </Box>
    );
  }
  return (
    <Box className="w-10 h-10 rounded-full items-center justify-center bg-surface-container-low border border-outline-variant">
      <Icon as={LockIcon} className="text-outline" size="md" />
    </Box>
  );
}

function CompletedStep({ data }: { data: Subtask }) {
  return (
    <VStack space="xs" className="flex-1 pt-1.5">
      <Text size="sm" strikeThrough className="font-medium text-outline">
        {data?.title || '???'}
      </Text>
      {data?.description ? (
        <Text size="xs" className="text-outline">
          {data.description}
        </Text>
      ) : null}
    </VStack>
  );
}

function LockedStep({ data }: { data: Subtask }) {
  return (
    <VStack space="xs" className="flex-1 pt-1.5">
      <Text size="sm" className="font-medium text-on-surface-variant">
        {data?.title || '???'}
      </Text>
      {data?.description ? (
        <Text size="xs" className="text-outline">
          {data.description}
        </Text>
      ) : null}
    </VStack>
  );
}

function InProgressStep({ data, taskId }: { data: Subtask; taskId: string }) {
  const router = useRouter();
  return (
    <Box className="flex-1 rounded-2xl bg-surface-container-low border border-outline-variant p-4 shadow-sm shadow-outline-variant/70">
      <VStack space="xs">
        <Text className="text-lg font-semibold text-[#3B59B6]">{data?.title || '???'}</Text>
        {data?.description ? (
          <Text size="sm" className="text-on-surface-variant">
            {data.description}
          </Text>
        ) : null}
        <HStack space="xs" className="items-center mt-1">
          <Icon as={ClockIcon} size="sm" className="text-on-surface-variant" />
          <Text size="xs" className="text-on-surface-variant">
            {formatEstimate(data.est_m)} estimated
          </Text>
        </HStack>
        <Button
          variant="solid"
          size="sm"
          onPress={() => router.navigate(`/focus/${data.id}?taskId=${taskId}`)}
          className="self-start mt-2 bg-[#3B59B6] border-[#3B59B6] rounded-full px-5"
        >
          <ButtonText className="text-white font-semibold">Start</ButtonText>
        </Button>
      </VStack>
    </Box>
  );
}

export function TimelineStep({ data, status, isLast, taskId }: TimelineStepProps) {
  return (
    <Box className="flex-row items-stretch">
      <Box className="w-12 items-center">
        <TimelineNode status={status} />
        {!isLast && <Box className="w-[2px] flex-1 bg-outline-variant mt-1" />}
      </Box>
      <Box className="flex-1 pl-3 pb-8">
        {status === 'completed' ? (
          <CompletedStep data={data} />
        ) : status === 'in_progress' ? (
          <InProgressStep data={data} taskId={taskId} />
        ) : (
          <LockedStep data={data} />
        )}
      </Box>
    </Box>
  );
}
