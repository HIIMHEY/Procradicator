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
  saveFocusSession,
  saveFocusSessionAndEnqueue,
} from './database';
import type { LocalFocusSessionRecord, OutboxRecord } from './databaseTypes';

const EMPTY_POSITION: SyncPosition = { logs: 0, rests: 0, completed: 0 };

function focusOperation(
  userId: string,
  entityId: string,
  operation: 'focus-create' | 'focus-update',
  payload: OutboxRecord['payload'],
  baseVersion: number | null,
  now: string,
): OutboxRecord {
  return {
    id: crypto.randomUUID(),
    userId,
    entityType: 'focusSession',
    entityId,
    operation,
    payload,
    baseVersion,
    createdAt: now,
  };
}

export async function createLocalFocusSession(
  userId: string,
  taskId: string,
  subtaskId: string,
  currentIdx: number,
  now = new Date().toISOString(),
): Promise<LocalFocusSessionRecord> {
  const id = crypto.randomUUID();
  const session: FocusSessionResponse = {
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
  };
  const state: State = {
    ...initial,
    sessionId: id,
    currentIdx,
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
    syncStatus: 'pending',
    terminal: false,
  };
  await saveFocusSessionAndEnqueue(
    record,
    focusOperation(
      userId,
      id,
      'focus-create',
      { id, subtask_id: subtaskId },
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
  const current = await getFocusSessionRecord(userId, sessionId);
  if (!current) throw new Error('Focus session is not available offline');
  const record: LocalFocusSessionRecord = {
    ...current,
    state,
  };
  await saveFocusSession(record);
  return record;
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
  const record: LocalFocusSessionRecord = {
    ...current,
    session: {
      ...current.session,
      updated_at: now,
      end_at: terminal ? now : current.session.end_at,
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
  await saveFocusSessionAndEnqueue(
    record,
    focusOperation(
      userId,
      sessionId,
      'focus-update',
      payload,
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

export function buildFullFocusPayload(record: LocalFocusSessionRecord): UpdateFocusPayload {
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
  };
}
