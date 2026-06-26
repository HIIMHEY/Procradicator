import { useForm, useFieldArray, Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ModifyTaskData, ModifyTaskSchema, TaskModifyMode } from '@/task/schema';
import useCreateTask from '@/task/hooks/useCreateTask';
import useUpdateTask from '@/task/hooks/useUpdateTask';
import useReadTask from '@/task/hooks/useReadTask';
import { useEffect } from 'react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { buildDepMap, formatSubtasks } from './utils';

dayjs.extend(utc);

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
    watch,
    reset,
    formState: { errors },
  } = useForm<ModifyTaskData>({
    resolver: zodResolver(ModifyTaskSchema as never) as Resolver<ModifyTaskData>, //ok as this is a known issue: https://github.com/react-hook-form/resolvers/issues/813
    defaultValues: { title: '', description: '', subtasks: [], due_at: dayjs().toISOString() },
  });

  // NOTE: all logic assumes a linear chain
  // TODO: update to generalised logic

  //subtasks is a field that is an array
  const { fields, append, move, remove } = useFieldArray({
    control,
    name: 'subtasks',
    keyName: 'rhf_id',
  });
  const currSubtasks = watch('subtasks') || [];

  //populate form with extant task data
  useEffect(() => {
    if (data && mode === 'Edit') {
      const depMap = buildDepMap(data.subtasks);
      reset({
        id: data.id || '',
        title: data.title || '',
        description: data.description || '',
        due_at: data.due_at ? dayjs.utc(data.due_at).toISOString() : dayjs().utc().toISOString(),
        subtasks: formatSubtasks(data.subtasks, depMap),
      });
    }
  }, [data, mode, reset]);

  const handleAddSubtask = () => {
    const genTempId = `temp-${dayjs().toISOString()}`;
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

  const handleDeleteSubtask = (idx: number) => {
    remove(idx);
  };

  const handleReorderSubtask = (fromIdx: number, toIdx: number) => {
    //cause apparently it can be currVals.length, like bruh
    //See: https://github.com/fivecar/react-native-draglist#:~:text=toIndex%20reflects%20the,data.length%5D).
    toIdx = Math.min(toIdx, currSubtasks.length - 1);
    if (toIdx === fromIdx) return;

    move(fromIdx, toIdx);
  };

  const onSubmit = handleSubmit((payload: ModifyTaskData) => {
    const subtasks = (payload.subtasks || []).map((subtask, idx, arr) => ({
      ...subtask,
      depends_on: idx === 0 ? [] : [arr[idx - 1].id],
    }));

    const finalPayload = {
      ...payload,
      subtasks,
    };

    const mutate = mode === 'Edit' ? updateMutate : createMutate;
    mutate(finalPayload, {
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
