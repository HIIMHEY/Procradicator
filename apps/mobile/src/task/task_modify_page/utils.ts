import dayjs from 'dayjs';
import { Subtask, ModifySubtaskData } from '@/task/schema';

//maps curr subtask id -> prev subtask id
export function buildDepMap(subtasks: Subtask[]): Map<string, string[]> {
  const depMap = new Map<string, string[]>();
  subtasks.forEach((subtask) => {
    if (Array.isArray(subtask.next_subtask)) {
      subtask.next_subtask.forEach((nextId) => {
        if (!depMap.has(nextId)) depMap.set(nextId, []);
        depMap.get(nextId)!.push(subtask.id);
      });
    }
  });
  return depMap;
}

//convert from Subtask schema to ModiftSubtaskSchema
//sigh, we should lowkey just stick to either next_subtask or depends_on
//TODO: decide
export function formatSubtasks(subtasks: Subtask[], depMap: Map<string, string[]>): ModifySubtaskData[] {
  return (subtasks || []).map((subtask) => ({
    ...subtask,
    id: subtask.id || `temp-${dayjs().toISOString()}`,
    depends_on: depMap.get(subtask.id) || [],
  })) as ModifySubtaskData[];
}
