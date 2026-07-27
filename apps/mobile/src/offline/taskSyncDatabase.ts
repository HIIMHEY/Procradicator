import { openDatabase, requestResult, STORES, transactionDone } from './databaseCore';
import type { LocalTaskRecord, OutboxRecord, TaskConflictRecord } from './databaseTypes';
import type { Task } from '@/task/schema';
import type { TaskWritePayload } from '@/task/taskApi';

export async function acknowledgeTaskOperation(
  operation: OutboxRecord,
  serverTask: Task | null,
): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction([STORES.tasks, STORES.outbox], 'readwrite');
  const done = transactionDone(transaction);
  const taskStore = transaction.objectStore(STORES.tasks);
  const outboxStore = transaction.objectStore(STORES.outbox);
  const [storedOperation, taskRecord, allOperations] = await Promise.all([
    requestResult<OutboxRecord | undefined>(outboxStore.get(operation.id)),
    requestResult<LocalTaskRecord | undefined>(
      taskStore.get(`${operation.userId}:${operation.entityId}`),
    ),
    requestResult<OutboxRecord[]>(outboxStore.getAll()),
  ]);
  if (!storedOperation || !taskRecord) {
    transaction.abort();
    await done;
    return;
  }

  outboxStore.delete(operation.id);
  const remaining = allOperations.filter(
    (candidate) =>
      candidate.id !== operation.id &&
      candidate.userId === operation.userId &&
      candidate.entityType === 'task' &&
      candidate.entityId === operation.entityId,
  );
  if (!serverTask) {
    if (remaining.length === 0) taskStore.delete(taskRecord.key);
  } else if (remaining.length === 0) {
    taskStore.put({
      ...taskRecord,
      task: serverTask,
      syncStatus: 'synced',
      deleted: false,
    });
  } else {
    taskStore.put({
      ...taskRecord,
      task: {
        ...taskRecord.task,
        version: serverTask.version,
        updated_at: serverTask.updated_at,
      },
      syncStatus: 'pending',
    });
    for (const pending of remaining) {
      outboxStore.put({ ...pending, baseVersion: serverTask.version });
    }
  }
  await done;
}

export async function saveTaskConflict(operation: OutboxRecord, serverTask: Task): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction([STORES.tasks, STORES.conflicts], 'readwrite');
  const done = transactionDone(transaction);
  const taskStore = transaction.objectStore(STORES.tasks);
  const taskRecord = await requestResult<LocalTaskRecord | undefined>(
    taskStore.get(`${operation.userId}:${operation.entityId}`),
  );
  if (!taskRecord) {
    transaction.abort();
    await done;
    return;
  }
  const conflict: TaskConflictRecord = {
    id: operation.id,
    userId: operation.userId,
    entityId: operation.entityId,
    operation: operation.operation as 'create' | 'update' | 'delete',
    localTask: taskRecord.deleted ? null : taskRecord.task,
    serverTask,
    baseVersion: operation.baseVersion,
    createdAt: new Date().toISOString(),
  };
  taskStore.put({ ...taskRecord, syncStatus: 'conflict' });
  transaction.objectStore(STORES.conflicts).put(conflict);
  await done;
}

export async function listTaskConflicts(userId: string): Promise<TaskConflictRecord[]> {
  const database = await openDatabase();
  const transaction = database.transaction(STORES.conflicts, 'readonly');
  const conflicts = await requestResult<TaskConflictRecord[]>(
    transaction.objectStore(STORES.conflicts).getAll(),
  );
  return conflicts
    .filter((conflict) => conflict.userId === userId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function replaceServerTasks(userId: string, serverTasks: Task[]): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(STORES.tasks, 'readwrite');
  const done = transactionDone(transaction);
  const store = transaction.objectStore(STORES.tasks);
  const records = await requestResult<LocalTaskRecord[]>(store.getAll());
  const localById = new Map(
    records.filter((record) => record.userId === userId).map((record) => [record.task.id, record]),
  );
  const serverIds = new Set(serverTasks.map((task) => task.id));

  for (const record of localById.values()) {
    if (record.syncStatus === 'synced' && !serverIds.has(record.task.id)) {
      store.delete(record.key);
    }
  }
  for (const task of serverTasks) {
    const current = localById.get(task.id);
    if (!current || current.syncStatus === 'synced') {
      store.put({
        key: `${userId}:${task.id}`,
        userId,
        task,
        syncStatus: 'synced',
        deleted: false,
      } satisfies LocalTaskRecord);
    }
  }
  await done;
}

function writePayload(task: Task): TaskWritePayload {
  const dependencies = new Map(task.subtasks.map((subtask) => [subtask.id, [] as string[]]));
  for (const subtask of task.subtasks) {
    for (const nextId of subtask.next_subtask) {
      dependencies.get(nextId)?.push(subtask.id);
    }
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

export async function resolveTaskConflictWithLocal(conflict: TaskConflictRecord): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(
    [STORES.tasks, STORES.outbox, STORES.conflicts],
    'readwrite',
  );
  const done = transactionDone(transaction);
  const taskStore = transaction.objectStore(STORES.tasks);
  const outboxStore = transaction.objectStore(STORES.outbox);
  const taskRecord = await requestResult<LocalTaskRecord | undefined>(
    taskStore.get(`${conflict.userId}:${conflict.entityId}`),
  );
  const operations = await requestResult<OutboxRecord[]>(outboxStore.getAll());
  if (!taskRecord) {
    transaction.abort();
    await done;
    return;
  }
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
  const localTask = {
    ...(conflict.localTask ?? taskRecord.task),
    version: conflict.serverTask.version,
    updated_at: now,
  };
  taskStore.put({
    ...taskRecord,
    task: localTask,
    syncStatus: 'pending',
    deleted: !conflict.localTask,
  });
  outboxStore.add({
    id: crypto.randomUUID(),
    userId: conflict.userId,
    entityType: 'task',
    entityId: conflict.entityId,
    operation: conflict.localTask ? 'update' : 'delete',
    payload: conflict.localTask ? writePayload(localTask) : null,
    baseVersion: conflict.serverTask.version,
    createdAt: now,
  } satisfies OutboxRecord);
  transaction.objectStore(STORES.conflicts).delete(conflict.id);
  await done;
}

export async function resolveTaskConflictWithServer(conflict: TaskConflictRecord): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(
    [STORES.tasks, STORES.outbox, STORES.conflicts],
    'readwrite',
  );
  const done = transactionDone(transaction);
  const outboxStore = transaction.objectStore(STORES.outbox);
  const operations = await requestResult<OutboxRecord[]>(outboxStore.getAll());
  for (const operation of operations) {
    if (
      operation.userId === conflict.userId &&
      operation.entityType === 'task' &&
      operation.entityId === conflict.entityId
    ) {
      outboxStore.delete(operation.id);
    }
  }
  transaction.objectStore(STORES.tasks).put({
    key: `${conflict.userId}:${conflict.entityId}`,
    userId: conflict.userId,
    task: conflict.serverTask,
    syncStatus: 'synced',
    deleted: false,
  } satisfies LocalTaskRecord);
  transaction.objectStore(STORES.conflicts).delete(conflict.id);
  await done;
}
