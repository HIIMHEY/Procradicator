import { useForm, useFieldArray, Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ModifySubtaskData, ModifyTaskData, ModifyTaskSchema, TaskModifyMode } from '@/task/schema';
import useCreateTask from '@/task/hooks/useCreateTask';
import useUpdateTask from '@/task/hooks/useUpdateTask';
import useReadTask from '@/task/hooks/useReadTask';
import { useEffect } from 'react';
import dayjs from 'dayjs';
import { buildDepMap, formatSubtasks } from './utils';

interface UseModifyTaskFormProps {
  id: string;
  mode: TaskModifyMode;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function useModifyTaskForm({ id, mode, onError, onSuccess }: UseModifyTaskFormProps) {
  const { mutate: createMutate, isPending: createPending } = useCreateTask();
  const { mutate: updateMutate, isPending: updatePending } = useUpdateTask(id);
  const { data, isPending, isError, error, refetch } = useReadTask(id, { isEnabled: !!id });

  const {
    control,
    handleSubmit,
    setValue,
    getValues,
    watch,
    reset,
    formState: { errors },
  } = useForm<ModifyTaskData>({
    resolver: zodResolver(ModifyTaskSchema as never) as Resolver<ModifyTaskData>, //ok as this is a known issue: https://github.com/react-hook-form/resolvers/issues/813
    defaultValues: { title: '', description: '', subtasks: [], due_at: dayjs().toISOString() },
  });

  //subtasks is a field that is an array
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: 'subtasks',
    keyName: 'rhf_id',
  });
  const currSubtasks = watch('subtasks');

  //populate form with extant task data
  useEffect(() => {
    if (data && mode === 'Edit') {
      const depMap = buildDepMap(data.subtasks);
      reset({
        id: data.id || '',
        title: data.title || '',
        description: data.description || '',
        due_at: data.due_at ? dayjs(data.due_at).toISOString() : dayjs().toISOString(),
        subtasks: formatSubtasks(data.subtasks, depMap),
      });
    }
  }, [data, mode, reset]);

  const handleAddSubtask = () => {
    const genTempId = `temp-${Date.now()}`;
    // VV this logic would need to be changed for more complex roadmaps VV
    const lastSubtask = currSubtasks[currSubtasks.length - 1];
    append({
      id: genTempId,
      title: '',
      description: '',
      estimate: 1,
      completed: 0,
      depends_on: lastSubtask ? [lastSubtask.id] : [], // can improve in future for more complex graphs
    });
  };

  const handleDeleteSubtask = (idx: number, itemId: string) => {
    setValue(
      'subtasks',
      currSubtasks.map((s) => ({ ...s, depends_on: s.depends_on.filter((id) => id !== itemId) })),
      { shouldValidate: true },
    );
    remove(idx);
  };

  const handleReorderSubtask = (fromIdx: number, toIdx: number) => {
    const currVals = getValues('subtasks') || [];
    //cause apparently it can be currVals.length, like bruh
    //See: https://github.com/fivecar/react-native-draglist#:~:text=toIndex%20reflects%20the,data.length%5D).
    toIdx = Math.min(toIdx, currVals.length - 1);
    if (toIdx == fromIdx) return;
    move(fromIdx, toIdx);
    const updatedDepArray = currVals.map((subtask: ModifySubtaskData, idx: number) => {
      if (idx === 0) return { ...subtask, depends_on: [] };
      return { ...subtask, depends_on: [currVals[idx - 1].id] };
    });
    setValue('subtasks', updatedDepArray, { shouldValidate: true });
  };

  const onSubmit = handleSubmit((payload: ModifyTaskData) => {
    const mutate = mode === 'Edit' ? updateMutate : createMutate;
    mutate(payload, {
      onError: onError,
      onSuccess: onSuccess,
    });
  });

  return {
    control,
    errors,
    currSubtasks,
    fields,
    isPending: mode === 'Edit' && isPending,
    isError,
    error,
    isMutating: createPending || updatePending,
    refetch,
    onSubmit,
    handleAddSubtask,
    handleDeleteSubtask,
    handleReorderSubtask,
  };
}
