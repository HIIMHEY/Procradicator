import dayjs from 'dayjs';
import { Subtask, ModifySubtaskData } from '@/task/schema';

//maps curr subtask id -> prev subtask id
export function buildDepMap(subtasks: Subtask[]): Map<string, string[]> {
  const depMap: Map<string, string[]> = new Map<string, string[]>();
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

export function toposort(subtasks: Subtask[], depMap: Map<string, string[]>): Subtask[] {
  const sorted: Subtask[] = [];
  const depMapCopy: Map<string, string[]> = new Map<string, string[]>();
  subtasks.forEach((subtask) => {
    depMapCopy.set(subtask.id, [...(depMap.get(subtask.id) || [])]);
  });

  const q: Subtask[] = subtasks.filter((subtask) => {
    const deps = depMapCopy.get(subtask.id);
    return !deps || deps.length === 0;
  });

  while (q.length > 0) {
    const curr: Subtask = q.shift()!;
    sorted.push(curr);

    subtasks.forEach((remainingSub) => {
      const deps = depMapCopy.get(remainingSub.id);

      if (deps && deps.includes(curr.id)) {
        const updatedDeps = deps.filter((id) => id !== curr.id);
        depMapCopy.set(remainingSub.id, updatedDeps);

        if (updatedDeps.length === 0) {
          q.push(remainingSub);
        }
      }
    });
  }
  if (sorted.length !== subtasks.length) {
    return subtasks;
  }
  return sorted;
}

//convert from Subtask schema to ModifySubtaskSchema
//sigh, we should lowkey just stick to either next_subtask or depends_on
//TODO: decide
export function formatSubtasks(
  subtasks: Subtask[],
  depMap: Map<string, string[]>,
): ModifySubtaskData[] {
  return (toposort(subtasks, depMap) || []).map((subtask) => ({
    ...subtask,
    id: subtask.id || `temp-${dayjs().toISOString()}`,
    depends_on: depMap.get(subtask.id) || [],
  })) as ModifySubtaskData[];
}
