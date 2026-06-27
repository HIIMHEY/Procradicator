import DragList, { DragListRenderItemInfo } from 'react-native-draglist';
import useReadTask from '../hooks/useReadTask';
import { View } from 'react-native';
import { ErrorFallback } from '../components/ErrorFallback';
import { NavigationBar } from '../components/NavigationBar';
import { Subtask } from '../schema';
import { Box } from '@/components/ui/box';
import { SubtaskNode } from './SubtaskNode';
import { TaskLoadingSkeleton } from './TaskLoadingSkeleton';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import dayjs from 'dayjs';

interface TaskRoadmapProps {
  id: string;
}

export function TaskRoadmap({ id }: TaskRoadmapProps) {
  const { data, isPending, isError, error, refetch } = useReadTask(id);
  const renderItem = ({ item }: DragListRenderItemInfo<Subtask>) => {
    const idx = data?.subtasks.findIndex((f: Subtask) => f.id === item.id);
    if (idx === -1) return null;
    const isIncomplete = item.completed < item.estimate;
    const prevCompleted =
      idx > 0 && data.subtasks[idx - 1].completed === data.subtasks[idx - 1].estimate;
    return (
      <SubtaskNode
        data={item}
        isLast={idx === data.subtasks.length - 1}
        isWorkable={(idx == 0 && isIncomplete) || prevCompleted}
      />
    );
  };
  if (isPending) return <TaskLoadingSkeleton />;
  return (
    <Box className="w-full h-screen max-h-screen flex flex-col overflow-hidden relative">
      <NavigationBar backurl="/tasks" />

      {isError ? (
        <ErrorFallback message={error.message} onRetry={refetch} />
      ) : (
        <View className="flex-1 w-full overflow-y-scroll">
          <View className="items-center justify-center px-6 py-8 border-b border-slate-100 bg-white/50">
            <Heading className="text-2xl font-bold text-center text-slate-800 mb-2">
              {data.title}
            </Heading>
            <Text className="text-sm text-center text-slate-500 max-w-xs mb-4">
              {data.description}
            </Text>
            <View className="bg-slate-100 px-3 py-1.5 rounded-full">
              <Text className="text-xs font-semibold text-slate-600 tracking-wide">
                Due: {dayjs(data.due_at).format('DD/MM/YYYY HH:mm')}
              </Text>
            </View>
          </View>
          <DragList
            className="flex-1 w-full py-16 px-6 bg-slate-50/60 rounded-3xl border border-dashed border-slate-200"
            contentContainerClassName="flex-col"
            data={data.subtasks}
            keyExtractor={(item: Subtask) => item.id}
            renderItem={renderItem}
          />
        </View>
      )}
    </Box>
  );
}
