import DragList from 'react-native-draglist';

import { View } from 'react-native';
import { ErrorFallback } from '../../components/ErrorFallback';
import { NavigationBar } from '../../components/NavigationBar';
import { Box } from '@/components/ui/box';

import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import dayjs from 'dayjs';
import { useTaskRoadmap } from '../useTaskRoadmap';
import { TaskLoadingSkeleton } from './TaskLoadingSkeleton';
import { SubtaskNode } from './SubtaskNode';
import { EmptyTaskPlaceholder } from './EmptyPlaceholder';

interface TaskRoadmapProps {
  id: string;
}

export function TaskRoadmap({ id }: TaskRoadmapProps) {
  const { data, isPending, isError, error, refetch } = useTaskRoadmap(id);

  if (isPending) return <TaskLoadingSkeleton />;

  const subtasksList = data?.subtasks || [];
  return (
    <Box className="w-full h-screen max-h-screen flex flex-col overflow-hidden relative">
      <NavigationBar backurl="/tasks" />

      {isError ? (
        <ErrorFallback message={error?.message} onRetry={refetch} />
      ) : !data ? (
        <EmptyTaskPlaceholder />
      ) : (
        <View className="flex-1 w-full overflow-y-scroll">
          <View className="items-center justify-center px-6 py-8 border-b border-slate-100 bg-white/50">
            <Heading className="text-2xl font-bold text-center text-slate-800 mb-2">
              {data?.title}
            </Heading>
            <Text className="text-sm text-center text-slate-500 max-w-xs mb-4">
              {data?.description}
            </Text>
            <View className="bg-slate-100 px-3 py-1.5 rounded-full">
              <Text className="text-xs font-semibold text-slate-600 tracking-wide">
                Due: {dayjs(data?.due_at).format('DD/MM/YYYY HH:mm')}
              </Text>
            </View>
          </View>
          <DragList
            className="flex-1 w-full py-16 px-6 bg-slate-50/60 rounded-3xl border border-dashed border-slate-200"
            contentContainerClassName="flex-col"
            data={subtasksList}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => {
              const isIncomplete = item.completed < item.estimate;
              const prevCompleted =
                index > 0 && subtasksList[index - 1].completed === subtasksList[index - 1].estimate;

              return (
                <SubtaskNode
                  data={item}
                  isLast={index === subtasksList.length - 1}
                  isWorkable={(index === 0 && isIncomplete) || prevCompleted}
                />
              );
            }}
          />
        </View>
      )}
    </Box>
  );
}
