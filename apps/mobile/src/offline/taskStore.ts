import { getTaskRecord, listTaskRecords, saveTaskAndEnqueue } from './database';
import { TaskOutboxRecordSchema } from './schemas';
import type { LocalTaskRecord, TaskOutboxRecord } from './schemas';
import type { ModifyTaskData, Task } from '@/task/schema';
import type { TaskWritePayload } from '@/task/schema';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function stableIds(
  values: ModifyTaskData,
  keepIds: boolean,
): {
  id: string;
  subtasks: TaskWritePayload['subtasks'];
} {
  const id = keepIds && values.id && UUID_PATTERN.test(values.id) ? values.id : crypto.randomUUID();
  const replacements = new Map(
    values.subtasks.map((subtask) => [
      subtask.id,
      keepIds && UUID_PATTERN.test(subtask.id) ? subtask.id : crypto.randomUUID(),
    ]),
  );
  return {
    id,
    subtasks: values.subtasks.map((subtask) => ({
      id: replacements.get(subtask.id)!,
      title: subtask.title,
      description: subtask.description,
      est_m: subtask.est_m,
      is_done: subtask.is_done,
      depends_on: subtask.depends_on.map(
        (dependencyId) => replacements.get(dependencyId) ?? dependencyId,
      ),
    })),
  };
}

function toTask(
  values: ModifyTaskData,
  previous: Task | null,
  now: string,
): {
  task: Task;
  payload: TaskWritePayload;
} {
  const normalized = stableIds({ ...values, id: values.id ?? previous?.id }, previous !== null);
  const nextById = new Map(normalized.subtasks.map((subtask) => [subtask.id, [] as string[]]));
  for (const subtask of normalized.subtasks) {
    for (const dependencyId of subtask.depends_on) {
      nextById.get(dependencyId)?.push(subtask.id);
    }
  }
  const payload: TaskWritePayload = {
    id: normalized.id,
    title: values.title,
    description: values.description,
    due_at: values.due_at,
    subtasks: normalized.subtasks,
  };
  return {
    payload,
    task: {
      id: normalized.id,
      title: values.title,
      description: values.description,
      due_at: values.due_at,
      updated_at: now,
      version: previous?.version ?? 0,
      subtasks: normalized.subtasks.map(({ depends_on: _dependsOn, ...subtask }) => ({
        ...subtask,
        next_subtask: nextById.get(subtask.id) ?? [],
      })),
    },
  };
}

function operation(
  userId: string,
  entityId: string,
  kind: 'create' | 'update' | 'delete',
  payload: TaskWritePayload | null,
  baseVersion: number | null,
  now: string,
): TaskOutboxRecord {
  return TaskOutboxRecordSchema.parse({
    id: crypto.randomUUID(),
    userId,
    entityType: 'task',
    entityId,
    operation: kind,
    payload,
    baseVersion,
    createdAt: now,
  });
}

export async function createLocalTask(
  userId: string,
  values: ModifyTaskData,
  now = new Date().toISOString(),
): Promise<Task> {
  const local = toTask(values, null, now);
  const record: LocalTaskRecord = {
    key: `${userId}:${local.task.id}`,
    userId,
    task: local.task,
    syncStatus: 'pending',
    deleted: false,
  };
  await saveTaskAndEnqueue(
    record,
    operation(userId, local.task.id, 'create', local.payload, null, now),
  );
  return local.task;
}

export async function updateLocalTask(
  userId: string,
  taskId: string,
  values: ModifyTaskData,
  now = new Date().toISOString(),
): Promise<Task> {
  const current = await getTaskRecord(userId, taskId);
  if (!current || current.deleted) throw new Error('Task is not available offline');
  const local = toTask({ ...values, id: taskId }, current.task, now);
  await saveTaskAndEnqueue(
    { ...current, task: local.task, syncStatus: 'pending' },
    operation(userId, taskId, 'update', local.payload, current.task.version || null, now),
  );
  return local.task;
}

export async function deleteLocalTask(
  userId: string,
  taskId: string,
  now = new Date().toISOString(),
): Promise<void> {
  const current = await getTaskRecord(userId, taskId);
  if (!current || current.deleted) return;
  await saveTaskAndEnqueue(
    {
      ...current,
      task: { ...current.task, updated_at: now },
      syncStatus: 'pending',
      deleted: true,
    },
    operation(userId, taskId, 'delete', null, current.task.version || null, now),
  );
}

export async function getLocalTask(userId: string, taskId: string): Promise<Task | null> {
  const record = await getTaskRecord(userId, taskId);
  return record && !record.deleted ? record.task : null;
}

export async function listLocalTasks(userId: string): Promise<Task[]> {
  const records = await listTaskRecords(userId);
  return records
    .map((record) => record.task)
    .sort((left, right) => left.due_at.localeCompare(right.due_at));
}
