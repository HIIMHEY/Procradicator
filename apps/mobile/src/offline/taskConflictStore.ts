import type { Task, TaskWritePayload } from '@/task/schema';
import { openDatabase, requestResult, STORES, transactionDone } from './databaseCore';
import {
  ConflictRecordSchema,
  LocalTaskRecordSchema,
  OutboxRecordSchema,
  TaskConflictRecordSchema,
  TaskOutboxRecordSchema,
} from './schemas';
import type { TaskConflictRecord, TaskOutboxRecord } from './schemas';

export async function saveTaskConflict(
  operation: TaskOutboxRecord,
  serverTask: Task | null,
): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction([STORES.tasks, STORES.conflicts], 'readwrite');
  const done = transactionDone(transaction);
  const taskStore = transaction.objectStore(STORES.tasks);
  const rawTask = await requestResult<unknown>(
    taskStore.get(`${operation.userId}:${operation.entityId}`),
  );
  if (rawTask === undefined) {
    await done;
    return;
  }
  const taskRecord = LocalTaskRecordSchema.parse(rawTask);
  const conflict = TaskConflictRecordSchema.parse({
    id: operation.id,
    userId: operation.userId,
    entityId: operation.entityId,
    operation: operation.operation,
    localTask: taskRecord.deleted ? null : taskRecord.task,
    serverTask,
    baseVersion: operation.baseVersion,
    createdAt: new Date().toISOString(),
  });
  taskStore.put(LocalTaskRecordSchema.parse({ ...taskRecord, syncStatus: 'conflict' }));
  transaction.objectStore(STORES.conflicts).put(conflict);
  await done;
}

export async function listTaskConflicts(userId: string): Promise<TaskConflictRecord[]> {
  const database = await openDatabase();
  const transaction = database.transaction(STORES.conflicts, 'readonly');
  return ConflictRecordSchema.array()
    .parse(await requestResult<unknown[]>(transaction.objectStore(STORES.conflicts).getAll()))
    .filter(
      (conflict): conflict is TaskConflictRecord =>
        conflict.userId === userId && 'localTask' in conflict,
    )
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function writePayload(task: Task): TaskWritePayload {
  const dependencies = new Map(task.subtasks.map((subtask) => [subtask.id, [] as string[]]));
  for (const subtask of task.subtasks) {
    for (const nextId of subtask.next_subtask) dependencies.get(nextId)?.push(subtask.id);
  }
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    due_at: task.due_at,
    subtasks: task.subtasks.map((subtask) => ({
      id: subtask.id,
      title: subtask.title,
      description: subtask.description,
      est_m: subtask.est_m,
      is_done: subtask.is_done,
      depends_on: dependencies.get(subtask.id) ?? [],
    })),
  };
}

export async function keepLocalTask(conflict: TaskConflictRecord): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(
    [STORES.tasks, STORES.outbox, STORES.conflicts],
    'readwrite',
  );
  const done = transactionDone(transaction);
  const taskStore = transaction.objectStore(STORES.tasks);
  const outboxStore = transaction.objectStore(STORES.outbox);
  const rawTask = await requestResult<unknown>(
    taskStore.get(`${conflict.userId}:${conflict.entityId}`),
  );
  const operations = OutboxRecordSchema.array().parse(
    await requestResult<unknown[]>(outboxStore.getAll()),
  );
  if (rawTask === undefined) {
    await done;
    return;
  }
  const taskRecord = LocalTaskRecordSchema.parse(rawTask);
  for (const operation of operations) {
    if (
      operation.userId === conflict.userId &&
      operation.entityType === 'task' &&
      operation.entityId === conflict.entityId
    ) {
      outboxStore.delete(operation.id);
    }
  }
  const now = new Date().toISOString();
  const localTask = conflict.localTask ?? taskRecord.task;
  if (!conflict.serverTask && !conflict.localTask) {
    taskStore.delete(taskRecord.key);
    transaction.objectStore(STORES.conflicts).delete(conflict.id);
    await done;
    return;
  }
  const baseVersion = conflict.serverTask?.version ?? null;
  taskStore.put(
    LocalTaskRecordSchema.parse({
      ...taskRecord,
      task: { ...localTask, version: baseVersion ?? 0, updated_at: now },
      syncStatus: 'pending',
      deleted: !conflict.localTask,
    }),
  );
  outboxStore.add(
    TaskOutboxRecordSchema.parse({
      id: crypto.randomUUID(),
      userId: conflict.userId,
      entityType: 'task',
      entityId: conflict.entityId,
      operation: conflict.localTask ? (baseVersion === null ? 'create' : 'update') : 'delete',
      payload: conflict.localTask ? writePayload(localTask) : null,
      baseVersion,
      createdAt: now,
    }),
  );
  transaction.objectStore(STORES.conflicts).delete(conflict.id);
  await done;
}
