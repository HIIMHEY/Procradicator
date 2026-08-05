import {
  FocusConflictError,
  FocusRequestError,
  readServerFocusSession,
  sendFocusOp,
} from '@/focus_session/focusApi';
import { getFocusSessionRecord, listOutbox } from './database';
import { keepLocalFocus, keepServerFocus } from './focusConflictStore';
import { ackFocusOp, saveFocusConflict } from './focusSyncDatabase';

export { listFocusConflicts } from './focusSyncDatabase';
export { keepLocalFocus, keepServerFocus };

export async function flushFocusOutbox(userId: string): Promise<void> {
  const operations = (await listOutbox(userId)).filter(
    (operation) => operation.entityType === 'focusSession',
  );
  for (const operation of operations) {
    const local = await getFocusSessionRecord(userId, operation.entityId);
    if (!local || local.syncStatus === 'conflict') continue;
    try {
      const serverSession = await sendFocusOp({
        opId: operation.id,
        sessionId: operation.entityId,
        operation: operation.operation,
        payload: operation.payload,
        baseVersion: operation.baseVersion,
      });
      await ackFocusOp(operation, serverSession);
      for (const pending of operations) {
        if (pending.entityId === operation.entityId && pending.id !== operation.id) {
          pending.baseVersion = serverSession.version;
        }
      }
    } catch (error) {
      if (error instanceof FocusConflictError) {
        await saveFocusConflict(operation, error.serverSession);
        continue;
      }
      if (
        error instanceof FocusRequestError &&
        error.status === 409 &&
        operation.operation === 'focus-create'
      ) {
        try {
          const server = await readServerFocusSession(operation.entityId);
          if (!server) return;
          await saveFocusConflict(operation, server);
          continue;
        } catch {
          return;
        }
      }
      return;
    }
  }
}
