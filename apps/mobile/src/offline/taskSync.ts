import { getTaskRecord, listOutbox } from './database';
import { ackTaskOp, replaceServerTasks, saveTaskConflict } from './taskSyncDatabase';
import {
  listServerTasks,
  readServerTask,
  sendTaskOp,
  TaskConflictError,
  TaskRequestError,
} from '@/task/taskApi';

export { listTaskConflicts } from './taskSyncDatabase';
export { keepLocalTask, keepServerTask } from './taskSyncDatabase';

export async function flushTaskOutbox(userId: string): Promise<void> {
  const operations = (await listOutbox(userId)).filter(
    (operation) => operation.entityType === 'task',
  );
  for (const operation of operations) {
    const task = await getTaskRecord(userId, operation.entityId);
    if (!task || task.syncStatus === 'conflict') continue;
    try {
      const serverTask = await sendTaskOp(operation);
      await ackTaskOp(operation, serverTask);
      if (serverTask) {
        for (const pending of operations) {
          if (pending.entityId === operation.entityId && pending.id !== operation.id) {
            pending.baseVersion = serverTask.version;
          }
        }
      }
    } catch (error) {
      if (error instanceof TaskConflictError) {
        await saveTaskConflict(operation, error.serverTask);
        continue;
      }
      if (error instanceof TaskRequestError && error.status === 404) {
        if (operation.operation === 'delete') {
          await ackTaskOp(operation, null);
          continue;
        }
      }
      if (
        error instanceof TaskRequestError &&
        error.status === 409 &&
        operation.operation === 'create'
      ) {
        try {
          await saveTaskConflict(operation, await readServerTask(operation.entityId));
          continue;
        } catch {
          return;
        }
      }
      return;
    }
  }
}

export async function pullServerTasks(userId: string): Promise<void> {
  const limit = 100;
  const tasks = [];
  for (let page = 1; ; page += 1) {
    const current = await listServerTasks(page, limit);
    tasks.push(...current);
    if (current.length < limit) break;
  }
  await replaceServerTasks(userId, tasks);
}
