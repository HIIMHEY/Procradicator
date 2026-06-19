import { FlatList, ActivityIndicator } from 'react-native';
import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { Button, ButtonText, ButtonIcon } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { AddIcon } from '@/components/ui/icon';
import useReadTask from '../hooks/useReadTask';
import { TaskListSkeleton } from './TaskListSkeleton';
import { BackendTask } from '../types/task';
import { TaskItem } from './TaskItem';

export function TaskDashboard() {
  const { data, isPending, isError, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useReadTask();
  const tasks: BackendTask[] = data?.pages.flatMap((page) => page.data) ?? [];
  const handleCreateTask = () => {
    console.log('create');
  };

  const handleLogout = () => {
    console.log(
      'Gabriel it is log out time (this is a placeholder yes, pls replace with actual function)',
    );
  };

  return (
    <Box className="flex-1 bg-slate-50 px-6 pt-12">
      <HStack className="justify-end mb-8 w-full">
        <Button
          size="sm"
          variant="solid"
          onPress={handleLogout}
          className="bg-orange-400 rounded-full px-6"
        >
          <ButtonText className="text-white text-xs font-medium">Log out</ButtonText>
        </Button>
      </HStack>

      <VStack className="items-center mb-6">
        <Text className="text-3xl font-bold text-slate-900 tracking-tight">Your Tasks</Text>
      </VStack>

      <Button
        size="lg"
        onPress={handleCreateTask}
        className="bg-indigo-600 rounded-xl py-3.5 mb-8 w-full shadow-sm active:bg-indigo-700"
      >
        <ButtonIcon as={AddIcon} className="text-white mr-2" />
        <ButtonText className="text-white font-semibold">Create Task</ButtonText>
      </Button>

      {isPending ? (
        <TaskListSkeleton />
      ) : isError ? (
        <>Error</> //TODO Error component
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Box className="mb-3">
              <TaskItem task={item} />
            </Box>
          )}
          showsVerticalScrollIndicator={false}
          className="pb-10"
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isFetchingNextPage ? (
              <Box className="py-4 items-center">
                <ActivityIndicator size="small" color="#4f46e5" />
              </Box>
            ) : null
          }
        />
      )}
    </Box>
  );
}
