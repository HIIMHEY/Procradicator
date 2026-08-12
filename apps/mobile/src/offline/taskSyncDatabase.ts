import type { Task } from '@/task/schema';
import { openDatabase, requestResult, STORES, transactionDone } from './databaseCore';
import {
  ConflictRecordSchema,
  LocalFocusSessionRecordSchema,
  LocalTaskRecordSchema,
  OutboxRecordSchema,
} from './schemas';
import type { LocalTaskRecord, TaskConflictRecord, TaskOutboxRecord } from './schemas';

export async function ackTaskOp(
  operation: TaskOutboxRecord,
  serverTask: Task | null,
): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction([STORES.tasks, STORES.outbox], 'readwrite');
  const done = transactionDone(transaction);
  const taskStore = transaction.objectStore(STORES.tasks);
  const outboxStore = transaction.objectStore(STORES.outbox);
  const [storedRaw, taskRaw, operationsRaw] = await Promise.all([
    requestResult<unknown>(outboxStore.get(operation.id)),
    requestResult<unknown>(taskStore.get(`${operation.userId}:${operation.entityId}`)),
    requestResult<unknown[]>(outboxStore.getAll()),
  ]);
  const taskRecord = taskRaw === undefined ? null : LocalTaskRecordSchema.parse(taskRaw);
  if (storedRaw === undefined || !taskRecord) {
    await done;
    return;
  }

  outboxStore.delete(operation.id);
  const remaining = OutboxRecordSchema.array()
    .parse(operationsRaw)
    .filter(
      (candidate) =>
        candidate.id !== operation.id &&
        candidate.userId === operation.userId &&
        candidate.entityType === 'task' &&
        candidate.entityId === operation.entityId,
    );
  if (!serverTask) {
    if (remaining.length === 0) taskStore.delete(taskRecord.key);
  } else if (remaining.length === 0) {
    taskStore.put(
      LocalTaskRecordSchema.parse({
        ...taskRecord,
        task: serverTask,
        syncStatus: 'synced',
        deleted: false,
      }),
    );
  } else {
    taskStore.put(
      LocalTaskRecordSchema.parse({
        ...taskRecord,
        task: {
          ...taskRecord.task,
          version: serverTask.version,
          updated_at: serverTask.updated_at,
        },
        syncStatus: 'pending',
      }),
    );
    for (const pending of remaining) {
      outboxStore.put(OutboxRecordSchema.parse({ ...pending, baseVersion: serverTask.version }));
    }
  }
  await done;
}

export async function replaceServerTasks(userId: string, serverTasks: Task[]): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(STORES.tasks, 'readwrite');
  const done = transactionDone(transaction);
  const store = transaction.objectStore(STORES.tasks);
  const records = LocalTaskRecordSchema.array().parse(
    await requestResult<unknown[]>(store.getAll()),
  );
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
      store.put(
        LocalTaskRecordSchema.parse({
          key: `${userId}:${task.id}`,
          userId,
          task,
          syncStatus: 'synced',
          deleted: false,
        } satisfies LocalTaskRecord),
      );
    }
  }
  await done;
}

export async function keepServerTask(conflict: TaskConflictRecord): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(
    [STORES.tasks, STORES.focusSessions, STORES.outbox, STORES.conflicts],
    'readwrite',
  );
  const done = transactionDone(transaction);
  const outboxStore = transaction.objectStore(STORES.outbox);
  const focusStore = transaction.objectStore(STORES.focusSessions);
  const conflictStore = transaction.objectStore(STORES.conflicts);
  const [operations, focusRecords, conflicts] = await Promise.all([
    requestResult<unknown[]>(outboxStore.getAll()).then((value) =>
      OutboxRecordSchema.array().parse(value),
    ),
    requestResult<unknown[]>(focusStore.getAll()).then((value) =>
      LocalFocusSessionRecordSchema.array().parse(value),
    ),
    requestResult<unknown[]>(conflictStore.getAll()).then((value) =>
      ConflictRecordSchema.array().parse(value),
    ),
  ]);
  const focusIds = new Set(
    focusRecords
      .filter((record) => record.userId === conflict.userId && record.taskId === conflict.entityId)
      .map((record) => record.session.id),
  );
  const serverDeleted = conflict.serverTask === null;
  for (const operation of operations) {
    if (
      operation.userId === conflict.userId &&
      ((operation.entityType === 'task' && operation.entityId === conflict.entityId) ||
        (serverDeleted &&
          operation.entityType === 'focusSession' &&
          focusIds.has(operation.entityId)))
    ) {
      outboxStore.delete(operation.id);
    }
  }
  const taskStore = transaction.objectStore(STORES.tasks);
  if (conflict.serverTask) {
    taskStore.put(
      LocalTaskRecordSchema.parse({
        key: `${conflict.userId}:${conflict.entityId}`,
        userId: conflict.userId,
        task: conflict.serverTask,
        syncStatus: 'synced',
        deleted: false,
      }),
    );
  } else {
    taskStore.delete(`${conflict.userId}:${conflict.entityId}`);
    for (const focusId of focusIds) focusStore.delete(`${conflict.userId}:${focusId}`);
    for (const storedConflict of conflicts) {
      if (
        'localSession' in storedConflict &&
        storedConflict.userId === conflict.userId &&
        storedConflict.localSession.taskId === conflict.entityId
      ) {
        conflictStore.delete(storedConflict.id);
      }
    }
  }
  conflictStore.delete(conflict.id);
  await done;
}
