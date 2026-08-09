import DragList from 'react-native-draglist';
import { Box } from '@/components/ui/box';
import { SubtaskNode } from './SubtaskNode';
import { DragListHeader } from './DragListHeader';
import { ModifyTaskFooter } from './ModifyTaskFooter';
import { AddSubtaskButton } from './AddSubtaskButton';
import { View } from 'react-native';
import { useToast, Toast, ToastTitle, ToastDescription } from '@/components/ui/toast';
import { useLocalSearchParams } from 'expo-router';
import { ErrorFallback } from '@/task/components/ErrorFallback';
import { TaskLoadingSkeleton } from './TaskLoadingSkeleton';
import { useModifyTaskForm } from '../useModifyTaskForm';
import { TaskModifyMode } from '@/task/schema';
import { TaskHeader } from '@/task/components/TaskHeader';

interface ModifyTaskPageProps {
  mode: TaskModifyMode;
}

export function ModifyTaskPage({ mode }: ModifyTaskPageProps) {
  const toast = useToast();
  const { id: rawId } = useLocalSearchParams();
  const id = Array.isArray(rawId) ? rawId[0] : rawId || '';

  const {
    control,
    errors,
    currSubtasks,
    fields,
    isPending,
    isError,
    error,
    isMutating,
    refetch,
    onSubmit,
    handleAddSubtask,
    handleDeleteSubtask,
    handleReorderSubtask,
  } = useModifyTaskForm({
    id,
    mode,
    onSuccess: () => {
      toast.show({
        placement: 'top',
        duration: 3000,
        render: () => (
          <Toast action="success">
            <ToastTitle>Task {mode} Successfully</ToastTitle>
          </Toast>
        ),
      });
    },
    onError: (err) => {
      toast.show({
        placement: 'top',
        duration: 3000,
        render: () => (
          <Toast action="error">
            <ToastTitle>Task {mode} Fail</ToastTitle>
            <ToastDescription>{err instanceof Error ? err.message : String(err)}</ToastDescription>
          </Toast>
        ),
      });
    },
  });

  if (isPending) return <TaskLoadingSkeleton />;

  return (
    <Box className="w-full h-full flex flex-col overflow-hidden relative bg-surface-container-low">
      <TaskHeader taskId={id || undefined} active="manual" backHref="/tasks" />
      <DragListHeader control={control} errors={errors} />

      <View className="flex-1 w-full overflow-y-scroll">
        {isError ? (
          <ErrorFallback message={error?.message} onRetry={refetch} />
        ) : (
          <DragList
            data={fields}
            keyExtractor={(item) => item.id}
            onReordered={handleReorderSubtask}
            renderItem={({ onDragStart, isActive, index }) => {
              return (
                <SubtaskNode
                  mode={mode}
                  control={control}
                  index={index}
                  onDragTrigger={onDragStart}
                  onDelete={() => handleDeleteSubtask(index)}
                  errors={errors.subtasks?.[index]}
                  isLast={index === fields.length - 1}
                  isActive={isActive}
                />
              );
            }}
            ListFooterComponent={<AddSubtaskButton onPress={handleAddSubtask} />}
          />
        )}
      </View>

      <ModifyTaskFooter
        mode={mode}
        isDisabled={currSubtasks.length === 0}
        isPending={isMutating}
        handleSubmit={onSubmit}
      />
    </Box>
  );
}
