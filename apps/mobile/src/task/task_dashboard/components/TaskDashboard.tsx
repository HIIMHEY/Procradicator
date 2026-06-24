import { useLogout } from '@/auth/hooks/useLogout';
import { FlatList, ActivityIndicator, View } from 'react-native';
import { Box } from '@/components/ui/box';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { Toast, ToastDescription, ToastTitle, useToast } from '@/components/ui/toast';
import { VStack } from '@/components/ui/vstack';
import { AddIcon, Icon } from '@/components/ui/icon';
import useReadTask from '../../hooks/useReadTasks';
import { Task } from '../../schema';
import { TaskItem } from './TaskItem';
import { TaskListSkeleton } from './TaskListSkeleton';
import { useRouter } from 'expo-router';
import { Heading } from '@/components/ui/heading';
import { ErrorFallback } from '../../components/ErrorFallback';
import { Smile } from 'lucide-react-native';

export function TaskDashboard() {
  const router = useRouter();
  const toast = useToast();
  const logoutMutation = useLogout();
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
      await logoutMutation.mutateAsync();
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
    <Box className="flex-1 w-full h-full bg-slate-50 px-6 pt-12 items-center">
      <HStack className="justify-end mb-8 w-full">
        <Button
          size="sm"
          variant="solid"
          onPress={handleLogout}
          isDisabled={logoutMutation.isPending}
          className="bg-orange-400 rounded-full px-6"
        >
          <ButtonText className="text-white text-xs font-medium">
            {logoutMutation.isPending ? 'Logging out...' : 'Log out'}
          </ButtonText>
        </Button>
      </HStack>

      <VStack className="items-center mb-6">
        <Heading className="text-3xl font-bold text-slate-900 tracking-tight">Your Tasks</Heading>
      </VStack>

      <Button
        size="lg"
        onPress={() => router.replace('/tasks/create')}
        className="bg-indigo-600 rounded-xl py-3.5 mb-8 shadow-sm active:bg-indigo-700"
      >
        <ButtonIcon as={AddIcon} className="text-white mr-2" />
        <ButtonText className="text-white font-semibold">Create Task</ButtonText>
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
          className="flex-1 w-full pb-10"
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              fetchNextPage();
            }
          }}
          refreshing={isRefetching}
          onRefresh={refetch}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <View className="justify-center items-center flex-1">
              <Icon as={Smile} size="xl" />
            </View>
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <Box className="py-4 items-center">
                <ActivityIndicator size="small" color="#4f46e5" />
              </Box>
            ) : (
              <Box className="py-4 items-center">
                <Text> You have reached the end </Text>
              </Box>
            )
          }
        />
      )}
    </Box>
  );
}
