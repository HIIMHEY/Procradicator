import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import DragList, { DragListRenderItemInfo } from 'react-native-draglist';
import { Box } from '@/components/ui/box';
import { SubtaskNode } from './SubtaskNode';
import {
  ModifySubtaskData,
  ModifyTaskData,
  ModifyTaskSchema,
  Subtask,
  TaskModifyMode,
} from '@/task/schema';
import { DragListHeader } from './DragListHeader';
import { DragListFooter } from './DragListFooter';
import { View } from 'react-native';
import { NavigationBar } from './NavigationBar';
import { EmptyTaskPlaceholder } from './EmptyPlaceholder';
import { useToast, Toast, ToastTitle, ToastDescription } from '@/components/ui/toast';
import useCreateTask from '@/task/hooks/useCreateTask';
import useUpdateTask from '@/task/hooks/useUpdateTask';
import { useLocalSearchParams } from 'expo-router';
import useReadTask from '@/task/hooks/useReadTask';
import { useEffect } from 'react';
import { ErrorFallback } from '@/task/components/ErrorFallback';
import { TaskLoadingSkeleton } from './TaskLoadingSkeleton';

interface ModifyTaskPageProps {
  mode: TaskModifyMode;
}

export function ModifyTaskPage({ mode }: ModifyTaskPageProps) {
  const {
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ModifyTaskData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(ModifyTaskSchema as any), //ok as this is a known issue: https://github.com/react-hook-form/resolvers/issues/813
    defaultValues: { title: '', description: '', subtasks: [] },
  });

  const toast = useToast();
  const { id: rawId } = useLocalSearchParams();
  const id = Array.isArray(rawId) ? rawId[0] : rawId || '';
  const { mutate: createMutate, isPending: createPending } = useCreateTask();
  const { mutate: updateMutate, isPending: updatePending } = useUpdateTask(id);
  const { data, isPending, isError, error, refetch } = useReadTask(id, { isEnabled: !!id });
  useEffect(() => {
    if (data && mode === 'Edit') {
      reset({
        title: data.title || '',
        description: data.description || '',
        subtasks:
          data.subtasks?.map((subtask: Subtask) => ({
            ...subtask,
            id: subtask.id || `temp-${Date.now()}`,
          })) || [],
      });
    }
  }, [data, mode, reset]);

  const onSubmit = (payload: ModifyTaskData) => {
    let mutate = createMutate;
    if (mode === 'Edit') {
      mutate = updateMutate;
    }
    mutate(payload, {
      onError: (error: Error) => {
        toast.show({
          placement: 'top',
          duration: 3000,
          render: () => (
            <Toast action="error" variant="solid">
              <ToastTitle>Task {mode} Failed</ToastTitle>
              <ToastDescription>{error.message}</ToastDescription>
            </Toast>
          ),
        });
      },
      onSuccess: () =>
        toast.show({
          placement: 'top',
          duration: 3000,
          render: () => {
            <Toast action="success" variant="solid">
              <ToastTitle>Task {mode} Successly</ToastTitle>
            </Toast>;
          },
        }),
    });
  };

  //subtasks is a field that is an array
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: 'subtasks',
    keyName: 'rhf_id', //RHF ID
  });

  const currSubtasks = watch('subtasks');

  const handleReorderSubtask = (fromIdx: number, toIdx: number) => {
    move(fromIdx, toIdx);
    const currVals = control._getWatch('subtasks') || [];

    const updatedDepArray = currVals.map((subtask: ModifySubtaskData, idx: number) => {
      if (idx === 0) {
        return { ...subtask, depends_on: [] };
      } else {
        const parentId = currVals[idx - 1].id;
        return { ...subtask, depends_on: [parentId] };
      }
    });

    setValue('subtasks', updatedDepArray, { shouldValidate: true });
  };

  const handleAddSubtask = () => {
    const genTempId = `temp-${Date.now()}`;
    const lastSubtask = currSubtasks[currSubtasks.length - 1];

    append({
      id: genTempId,
      title: '',
      description: '',
      estimate: 0,
      is_done: false,
      depends_on: lastSubtask ? [lastSubtask.id] : [], // can improve in future for more complex graphs
    });
  };

  const renderItem = ({
    item,
    onDragStart,
    isActive,
  }: DragListRenderItemInfo<ModifySubtaskData>) => {
    // find the actual index in the form array to bind controls correctly
    const idx = fields.findIndex((f) => f.id === item.id);
    if (idx === -1) return null;

    return (
      <SubtaskNode
        control={control}
        mode={mode}
        index={idx}
        onDragTrigger={onDragStart}
        onDelete={() => remove(idx)}
        errors={errors.subtasks?.[idx]}
        isLast={idx === fields.length - 1}
        isActive={isActive}
      />
    );
  };

  if (mode == 'Edit' && isPending) {
    return <TaskLoadingSkeleton />;
  }

  return (
    <Box className="w-full h-screen max-h-screen flex flex-col overflow-hidden relative">
      <NavigationBar />
      <DragListHeader control={control} errors={errors} />

      {isError ? (
        <ErrorFallback message={error.message} onRetry={refetch} />
      ) : (
        <View className="flex-1 w-full overflow-y-scroll">
          {currSubtasks.length == 0 ? (
            <EmptyTaskPlaceholder />
          ) : (
            <DragList
              className="flex-1 w-full py-16 px-6 bg-slate-50/60 rounded-3xl border border-dashed border-slate-200"
              contentContainerClassName="flex-col"
              data={currSubtasks}
              keyExtractor={(item) => item.id}
              onReordered={handleReorderSubtask}
              renderItem={renderItem}
            />
          )}
        </View>
      )}

      <DragListFooter
        isDisabled={currSubtasks.length === 0}
        isPending={updatePending || createPending}
        handleSubmit={handleSubmit(onSubmit)}
        handleAddSubtask={handleAddSubtask}
      />
    </Box>
  );
}
