import { Box } from '@/components/ui/box';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { ScrollView } from 'react-native';
import dayjs from 'dayjs';
import { useTaskRoadmap } from '../useTaskRoadmap';
import { ErrorFallback } from '../../components/ErrorFallback';
import { NavigationBar } from '../../components/NavigationBar';
import { TaskLoadingSkeleton } from './TaskLoadingSkeleton';
import { EmptyTaskPlaceholder } from './EmptyPlaceholder';
import { TimelineStep, TimelineStatus } from './TimelineStep';
import { Subtask } from '../../schema';

interface TaskRoadmapProps {
  id: string;
}

function stepStatus(subtasks: Subtask[], index: number): TimelineStatus {
  const item = subtasks[index];
  if (item.is_done) return 'completed';
  const isWorkable = index === 0 || subtasks[index - 1].is_done;
  return isWorkable ? 'in_progress' : 'locked';
}

export function TaskRoadmap({ id }: TaskRoadmapProps) {
  const { data, isPending, isError, error, refetch } = useTaskRoadmap(id);

  if (isPending) return <TaskLoadingSkeleton />;

  const subtasksList = data?.subtasks || [];
  return (
    <Box className="w-full h-full flex flex-col overflow-hidden relative bg-surface-container-low">
      <NavigationBar backurl="/tasks" />

      {isError ? (
        <ErrorFallback message={error?.message} onRetry={refetch} />
      ) : !data ? (
        <EmptyTaskPlaceholder />
      ) : (
        <ScrollView className="flex-1 w-full" contentContainerClassName="px-6 pb-10">
          <Box className="pt-8 pb-6">
            <Heading className="text-2xl font-bold text-on-surface mb-2">{data.title}</Heading>
            {data.description ? (
              <Text size="sm" className="text-on-surface-variant mb-4">
                {data.description}
              </Text>
            ) : null}
            <Box className="bg-surface-container-low px-3 py-1.5 rounded-full self-start">
              <Text className="text-xs font-semibold text-on-surface-variant tracking-wide">
                Due: {dayjs(data.due_at).format('DD/MM/YYYY HH:mm')}
              </Text>
            </Box>
          </Box>
          <Box className="pt-2">
            {subtasksList.map((item, index) => (
              <TimelineStep
                key={item.id}
                data={item}
                status={stepStatus(subtasksList, index)}
                isLast={index === subtasksList.length - 1}
                taskId={id}
              />
            ))}
          </Box>
        </ScrollView>
      )}
    </Box>
  );
}
