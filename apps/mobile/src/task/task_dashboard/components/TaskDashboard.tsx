import { Box } from '@/components/ui/box';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { AddIcon, Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { NavBar } from '@/navigation/components/NavBar';
import { useRouter } from 'expo-router';
import { Smile } from 'lucide-react-native';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { ErrorFallback } from '../../components/ErrorFallback';
import useReadTask from '../../hooks/useReadTasks';
import type { Task } from '../../schema';
import { TaskItem } from './TaskItem';
import { TaskListSkeleton } from './TaskListSkeleton';

export function TaskDashboard() {
  const router = useRouter();
  const {
    data,
    isPending,
    isError,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
    isRefetching,
  } = useReadTask();
  const tasks: Task[] = data?.pages.flatMap((page) => page || []) ?? [];

  return (
    <Box className="h-full w-full flex-1 bg-[#F7F8FC]">
      <NavBar active="tasks" title="Your Tasks" />
      <Box className="w-full flex-1 items-center px-6 pt-4">
        {isPending ? (
          <TaskListSkeleton />
        ) : isError ? (
          <ErrorFallback message={error.message} onRetry={refetch} />
        ) : (
          <FlatList
            contentContainerClassName="w-full items-center justify-start"
            data={tasks}
            keyExtractor={(item) => item?.id}
            renderItem={({ item }) => (
              <Box className="mb-3 w-full max-w-xl">
                <TaskItem task={item} />
              </Box>
            )}
            showsVerticalScrollIndicator={false}
            className="w-full flex-1 pb-24"
            onEndReached={() => {
              if (hasNextPage && !isFetchingNextPage) {
                fetchNextPage();
              }
            }}
            refreshing={isRefetching}
            onRefresh={refetch}
            onEndReachedThreshold={0.5}
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center">
                <Icon as={Smile} size="xl" />
              </View>
            }
            ListFooterComponent={
              isFetchingNextPage ? (
                <Box className="items-center py-4">
                  <ActivityIndicator size="small" color="#4f46e5" />
                </Box>
              ) : (
                <Box className="items-center py-4">
                  <Text> You have reached the end </Text>
                </Box>
              )
            }
          />
        )}
      </Box>

      <Button
        size="lg"
        onPress={() => router.replace('/tasks/create')}
        className="absolute bottom-8 right-6 z-50 rounded-full bg-[#3B59B6] px-7 py-4 shadow-lg active:bg-[#2f4891]"
      >
        <ButtonIcon as={AddIcon} className="mr-2 text-white" />
        <ButtonText className="font-semibold text-white">Create</ButtonText>
      </Button>
    </Box>
  );
}
