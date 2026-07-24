import { useLogout } from '@/auth/hooks/useLogout';
import { Box } from '@/components/ui/box';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { AddIcon, Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Toast, ToastDescription, ToastTitle, useToast } from '@/components/ui/toast';
import { VStack } from '@/components/ui/vstack';
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
  const toast = useToast();
  const { mutateAsync: logout, isPending: isLoggingOut } = useLogout();
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

  const handleLogout = async () => {
    try {
      await logout();
      router.replace('/');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not log out.';
      toast.show({
        placement: 'top',
        duration: 3000,
        render: () => (
          <Toast action="error" variant="solid">
            <ToastTitle>Logout Failed</ToastTitle>
            <ToastDescription>{message}</ToastDescription>
          </Toast>
        ),
      });
    }
  };
  return (
    <Box className="h-full w-full flex-1 bg-slate-50">
      <NavBar active="tasks" title="Dashboard" />
      <Box className="w-full flex-1 items-center px-6 pt-4">
        <HStack className="mb-8 w-full justify-end">
          <Button
            size="sm"
            variant="solid"
            onPress={handleLogout}
            isDisabled={isLoggingOut}
            className="rounded-full bg-orange-400 px-6"
          >
            <ButtonText className="text-xs font-medium text-white">
              {isLoggingOut ? 'Logging out...' : 'Log out'}
            </ButtonText>
          </Button>
        </HStack>

        <VStack className="mb-6 items-center">
          <Heading className="text-3xl font-bold tracking-tight text-slate-900">Your Tasks</Heading>
        </VStack>

        <Button
          size="lg"
          onPress={() => router.replace('/tasks/create')}
          className="mb-8 rounded-xl bg-indigo-600 py-3.5 shadow-sm active:bg-indigo-700"
        >
          <ButtonIcon as={AddIcon} className="mr-2 text-white" />
          <ButtonText className="font-semibold text-white">Create Task</ButtonText>
        </Button>

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
            className="w-full flex-1 pb-10"
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
                {/*The somehow when I try to put text here it gives me an error so a smile it shall be*/}
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
    </Box>
  );
}
