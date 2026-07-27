import { FocusConflictError, sendFocusOperation } from '@/focus_session/focusApi';
import { getFocusSessionRecord, listOutbox } from './database';
import {
  acknowledgeFocusOperation,
  saveFocusConflict,
} from './focusSyncDatabase';

export {
  listFocusConflicts,
  resolveFocusConflictWithLocal,
  resolveFocusConflictWithServer,
} from './focusSyncDatabase';

export async function flushFocusOutbox(userId: string): Promise<void> {
  const operations = (await listOutbox(userId)).filter(
    (operation) => operation.entityType === 'focusSession',
  );
  for (const operation of operations) {
    const local = await getFocusSessionRecord(userId, operation.entityId);
    if (!local || local.syncStatus === 'conflict') continue;
    try {
      const serverSession = await sendFocusOperation(operation);
      await acknowledgeFocusOperation(operation, serverSession);
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
      return;
    }
  }
}
