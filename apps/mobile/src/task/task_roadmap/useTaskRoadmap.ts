import { useMemo } from 'react';
import useReadTask from '../hooks/useReadTask';
import { buildDepMap, toposort } from '../utils';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

export function useTaskRoadmap(id: string) {
  const { data, isPending, isError, error, refetch } = useReadTask(id);

  const processed = useMemo(() => {
    if (!data) return null;

    const depMap = buildDepMap(data.subtasks);

    return {
      id: data.id || '',
      title: data.title || '',
      description: data.description || '',
      due_at: data.due_at ? dayjs.utc(data.due_at).toISOString() : dayjs().utc().toISOString(),
      subtasks: toposort(data.subtasks, depMap),
    };
  }, [data]);

  return {
    data: processed,
    isPending,
    isError,
    error,
    refetch,
  };
}
