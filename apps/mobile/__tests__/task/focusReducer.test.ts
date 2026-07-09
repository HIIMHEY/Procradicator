/// <reference types="jest" />

import { focusReducer, initial, type State } from '@/task/focus_session/focusReducer';

const baseState = (overrides?: Partial<State>): State => ({
  ...initial,
  ...overrides,
});

test('SESSION_CREATED sets sessionId, workCycleM, restCycleM', () => {
  const s = focusReducer(baseState(), {
    type: 'SESSION_CREATED',
    sessionId: 's1',
    workCycleM: 30,
    restCycleM: 10,
  });
  expect(s.sessionId).toBe('s1');
  expect(s.workCycleM).toBe(30);
  expect(s.restCycleM).toBe(10);
});

test('SESSION_RECOVERED sets all recovery fields', () => {
  const s = focusReducer(baseState(), {
    type: 'SESSION_RECOVERED',
    sessionId: 's1',
    workCycleM: 30,
    restCycleM: 10,
    workCycles: 3,
    restCycles: 2,
  });
  expect(s.sessionId).toBe('s1');
  expect(s.workCycleM).toBe(30);
  expect(s.restCycleM).toBe(10);
  expect(s.workCycles).toBe(3);
  expect(s.restCycles).toBe(2);
});

test('START_WORK transitions READY to WORK, resets isOT, sets phaseStartedAt', () => {
  const before = Date.now();
  const s = focusReducer(baseState({ phase: 'READY', isOT: true }), {
    type: 'START_WORK',
  });
  expect(s.phase).toBe('WORK');
  expect(s.isOT).toBe(false);
  expect(s.phaseStartedAt).not.toBeNull();
  expect(s.phaseStartedAt!).toBeGreaterThanOrEqual(before);
});

test('SUBTASK_COMPLETED from WORK !isOT to CONGRATS when last subtask', () => {
  const before = Date.now();
  const s = focusReducer(baseState({ phase: 'WORK', isOT: false, currentIdx: 5 }), {
    type: 'SUBTASK_COMPLETED',
    now: before,
    subtaskId: 'st-6',
    nextExists: false,
    startAt: '2026-01-01T00:00:00Z',
  });
  expect(s.phase).toBe('CONGRATS');
  expect(s.workCycles).toBe(1);
  expect(s.completedIds).toEqual(['st-6']);
  expect(s.focusLogs).toHaveLength(1);
  expect(s.focusLogs[0].subtask_id).toBe('st-6');
  expect(s.currentIdx).toBe(5);
});

test('SUBTASK_COMPLETED from WORK !isOT to WORK when next exists, advances idx', () => {
  const s = focusReducer(baseState({ phase: 'WORK', isOT: false, currentIdx: 2 }), {
    type: 'SUBTASK_COMPLETED',
    now: Date.now(),
    subtaskId: 'st-3',
    nextExists: true,
    startAt: '2026-01-01T00:00:00Z',
  });
  expect(s.phase).toBe('WORK');
  expect(s.currentIdx).toBe(3);
  expect(s.completedIds).toEqual(['st-3']);
});

test('SUBTASK_COMPLETED from WORK isOT to REST, does NOT advance idx', () => {
  const s = focusReducer(baseState({ phase: 'WORK', isOT: true, currentIdx: 2 }), {
    type: 'SUBTASK_COMPLETED',
    now: Date.now(),
    subtaskId: 'st-3',
    nextExists: true,
    startAt: '2026-01-01T00:00:00Z',
  });
  expect(s.phase).toBe('REST');
  expect(s.currentIdx).toBe(2);
  expect(s.isOT).toBe(false);
});

test('SUBTASK_COMPLETED from WORK isOT to REST when no next', () => {
  const s = focusReducer(baseState({ phase: 'WORK', isOT: true, currentIdx: 5 }), {
    type: 'SUBTASK_COMPLETED',
    now: Date.now(),
    subtaskId: 'st-6',
    nextExists: false,
    startAt: '2026-01-01T00:00:00Z',
  });
  expect(s.phase).toBe('REST');
  expect(s.currentIdx).toBe(5);
});

test('ENTER_OT sets isOT true, stays in WORK', () => {
  const s = focusReducer(baseState({ phase: 'WORK', isOT: false }), {
    type: 'ENTER_OT',
  });
  expect(s.isOT).toBe(true);
  expect(s.phase).toBe('WORK');
});

test('REST_COMPLETE with hasMore to READY', () => {
  const s = focusReducer(baseState({ phase: 'REST', restCycles: 0 }), {
    type: 'REST_COMPLETE',
    hasMore: true,
  });
  expect(s.phase).toBe('READY');
  expect(s.restCycles).toBe(1);
  expect(s.phaseStartedAt).not.toBeNull();
});

test('REST_COMPLETE without hasMore to CONGRATS', () => {
  const s = focusReducer(baseState({ phase: 'REST' }), {
    type: 'REST_COMPLETE',
    hasMore: false,
  });
  expect(s.phase).toBe('CONGRATS');
  expect(s.restCycles).toBe(1);
});

test('OPEN_EXIT_REASON captures current phase, sets EXIT_REASON', () => {
  const s = focusReducer(baseState({ phase: 'WORK' }), {
    type: 'OPEN_EXIT_REASON',
  });
  expect(s.phase).toBe('EXIT_REASON');
  expect(s.previousPhase).toBe('WORK');
});

test('CLOSE_EXIT_REASON restores previous phase', () => {
  const s = focusReducer(baseState({ phase: 'EXIT_REASON', previousPhase: 'WORK' }), {
    type: 'CLOSE_EXIT_REASON',
  });
  expect(s.phase).toBe('WORK');
  expect(s.previousPhase).toBeNull();
});

test('CLOSE_EXIT_REASON defaults to READY when no previousPhase', () => {
  const s = focusReducer(baseState({ phase: 'EXIT_REASON', previousPhase: null }), {
    type: 'CLOSE_EXIT_REASON',
  });
  expect(s.phase).toBe('READY');
});

test('EXIT_TO_CONGRATS sets phase to CONGRATS', () => {
  const s = focusReducer(baseState({ phase: 'WORK' }), {
    type: 'EXIT_TO_CONGRATS',
  });
  expect(s.phase).toBe('CONGRATS');
});
