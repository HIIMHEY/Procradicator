import { initial } from '@/focus_session/focusReducer';
import type {
  FocusSessionResponse,
  State,
  SyncPosition,
  UpdateFocusPayload,
} from '@/focus_session/schemas';
import {
  findFocusSessionRecord,
  getFocusSessionRecord,
  saveFocusAndEnqueue,
  saveFocusSession,
  updateFocusState,
} from './database';
import { FocusOutboxRecordSchema } from './schemas';
import type { FocusOutboxRecord, LocalFocusSessionRecord } from './schemas';

const EMPTY_POSITION: SyncPosition = { logs: 0, rests: 0, completed: 0 };

function focusOperation(
  userId: string,
  entityId: string,
  operation: 'focus-create' | 'focus-update',
  payload: FocusOutboxRecord['payload'],
  baseVersion: number | null,
  now: string,
): FocusOutboxRecord {
  return FocusOutboxRecordSchema.parse({
    id: crypto.randomUUID(),
    userId,
    entityType: 'focusSession',
    entityId,
    operation,
    payload,
    baseVersion,
    createdAt: now,
  });
}

export async function createLocalFocusSession(
  userId: string,
  taskId: string,
  subtaskId: string,
  currentIdx: number,
  now = new Date().toISOString(),
  serverSession?: FocusSessionResponse,
): Promise<LocalFocusSessionRecord> {
  const id = serverSession?.id ?? crypto.randomUUID();
  const session: FocusSessionResponse =
    serverSession ??
    ({
      id,
      user_id: userId,
      start_at: now,
      updated_at: now,
      end_at: null,
      version: 0,
      work_cycle_m: initial.workCycleM,
      rest_cycle_m: initial.restCycleM,
      work_cycles: 0,
      rest_cycles: 0,
      total_overtime_s: 0,
      abandon_reason: null,
    } satisfies FocusSessionResponse);
  const state: State = {
    ...initial,
    sessionId: id,
    currentIdx,
    workCycleM: session.work_cycle_m,
    restCycleM: session.rest_cycle_m,
    focusLogs: [],
    restLogs: [],
    completedIds: [],
  };
  const record: LocalFocusSessionRecord = {
    key: `${userId}:${id}`,
    userId,
    taskId,
    subtaskId,
    session,
    state,
    queued: { ...EMPTY_POSITION },
    syncStatus: serverSession ? 'synced' : 'pending',
    terminal: session.end_at !== null,
  };
  if (serverSession) {
    await saveFocusSession(record);
    return record;
  }
  await saveFocusAndEnqueue(
    record,
    focusOperation(
      userId,
      id,
      'focus-create',
      {
        id,
        subtask_id: subtaskId,
        start_at: session.start_at,
        work_cycle_m: session.work_cycle_m,
        rest_cycle_m: session.rest_cycle_m,
      },
      null,
      now,
    ),
  );
  return record;
}

export async function saveLocalFocusState(
  userId: string,
  sessionId: string,
  state: State,
): Promise<LocalFocusSessionRecord> {
  return updateFocusState(userId, sessionId, state);
}

export async function saveLocalFocusProgress(
  userId: string,
  sessionId: string,
  state: State,
  payload: UpdateFocusPayload,
  terminal = false,
  now = new Date().toISOString(),
  queued: SyncPosition = {
    logs: state.focusLogs.length,
    rests: state.restLogs.length,
    completed: state.completedIds.length,
  },
): Promise<LocalFocusSessionRecord> {
  const current = await getFocusSessionRecord(userId, sessionId);
  if (!current) throw new Error('Focus session is not available offline');
  const endAt = terminal ? now : current.session.end_at;
  const record: LocalFocusSessionRecord = {
    ...current,
    session: {
      ...current.session,
      updated_at: now,
      end_at: endAt,
      work_cycles: state.workCycles,
      rest_cycles: state.restCycles,
      total_overtime_s: state.OTSecondsTotal,
      abandon_reason: state.abandonReason,
    },
    state,
    queued,
    syncStatus: 'pending',
    terminal: current.terminal || terminal,
  };
  await saveFocusAndEnqueue(
    record,
    focusOperation(
      userId,
      sessionId,
      'focus-update',
      endAt ? { ...payload, end_at: endAt } : payload,
      current.session.version || null,
      now,
    ),
  );
  return record;
}

export async function getLocalFocusSession(
  userId: string,
  sessionId: string,
): Promise<LocalFocusSessionRecord | null> {
  return getFocusSessionRecord(userId, sessionId);
}

export async function findLocalFocusSession(
  userId: string,
  taskId: string,
  subtaskId: string,
): Promise<LocalFocusSessionRecord | null> {
  return findFocusSessionRecord(userId, taskId, subtaskId);
}

export function buildFocusPayload(record: LocalFocusSessionRecord): UpdateFocusPayload {
  return {
    focus_logs: record.state.focusLogs,
    rest_logs: record.state.restLogs,
    completed_subtask_ids: record.state.completedIds,
    work_cycles: record.state.workCycles,
    rest_cycles: record.state.restCycles,
    ...(record.terminal && record.state.abandonReason
      ? { abandon_reason: record.state.abandonReason }
      : {}),
    ...(record.terminal && !record.state.abandonReason
      ? { total_overtime_s: record.state.OTSecondsTotal }
      : {}),
    ...(record.terminal && record.session.end_at ? { end_at: record.session.end_at } : {}),
  };
}
