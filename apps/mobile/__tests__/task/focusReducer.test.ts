/// <reference types="jest" />

import { focusReducer, initial } from '@/focus_session/focusReducer';
import { State } from '@/focus_session/schemas';

const baseState = (overrides?: Partial<State>): State => ({
  ...initial,
  ...overrides,
});

test('CREATE_SESSION sets sessionId, workCycleM, restCycleM', () => {
  const s = focusReducer(baseState(), {
    type: 'CREATE_SESSION',
    sessionId: 's1',
    workCycleM: 30,
    restCycleM: 10,
    currentIdx: 2,
  });
  expect(s.sessionId).toBe('s1');
  expect(s.workCycleM).toBe(30);
  expect(s.restCycleM).toBe(10);
  expect(s.currentIdx).toBe(2);
});

test('START_WORK transitions READY > WORK, resets isOT, sets phaseStartedAt', () => {
  const before = Date.now();
  const s = focusReducer(baseState({ phase: 'READY', isOT: true }), {
    type: 'START_WORK',
  });
  expect(s.phase).toBe('WORK');
  expect(s.isOT).toBe(false);
  expect(s.phaseStartedAt).not.toBeNull();
  expect(s.phaseStartedAt!).toBeGreaterThanOrEqual(before);
});

test('COMPLETE_SUBTASK from WORK !isOT REST when last subtask', () => {
  const before = Date.now();
  const s = focusReducer(baseState({ phase: 'WORK', isOT: false, currentIdx: 5 }), {
    type: 'COMPLETE_SUBTASK',
    now: before,
    subtaskId: 'st-6',
    nextExists: false,
    startAt: '2026-01-01T00:00:00Z',
    OTSeconds: 0,
  });
  expect(s.phase).toBe('REST');
  expect(s.workCycles).toBe(1);
  expect(s.completedIds).toEqual(['st-6']);
  expect(s.focusLogs).toHaveLength(1);
  expect(s.focusLogs[0].subtask_id).toBe('st-6');
  expect(s.currentIdx).toBe(5);
});

test('COMPLETE_SUBTASK from WORK !isOT WORK when next exists, advances idx', () => {
  const s = focusReducer(baseState({ phase: 'WORK', isOT: false, currentIdx: 2 }), {
    type: 'COMPLETE_SUBTASK',
    now: Date.now(),
    subtaskId: 'st-3',
    nextExists: true,
    startAt: '2026-01-01T00:00:00Z',
    OTSeconds: 0,
  });
  expect(s.phase).toBe('WORK');
  expect(s.currentIdx).toBe(3);
  expect(s.completedIds).toEqual(['st-3']);
});

test('COMPLETE_SUBTASK from WORK isOT REST, does NOT advance idx', () => {
  const s = focusReducer(baseState({ phase: 'WORK', isOT: true, currentIdx: 2 }), {
    type: 'COMPLETE_SUBTASK',
    now: Date.now(),
    subtaskId: 'st-3',
    nextExists: true,
    startAt: '2026-01-01T00:00:00Z',
    OTSeconds: 30,
  });
  expect(s.phase).toBe('REST');
  expect(s.currentIdx).toBe(2);
  expect(s.isOT).toBe(false);
  expect(s.OTSecondsTotal).toBe(30);
});

test('COMPLETE_SUBTASK from WORK isOT REST when no next', () => {
  const s = focusReducer(baseState({ phase: 'WORK', isOT: true, currentIdx: 5 }), {
    type: 'COMPLETE_SUBTASK',
    now: Date.now(),
    subtaskId: 'st-6',
    nextExists: false,
    startAt: '2026-01-01T00:00:00Z',
    OTSeconds: 15,
  });
  expect(s.phase).toBe('REST');
  expect(s.currentIdx).toBe(5);
  expect(s.OTSecondsTotal).toBe(15);
});

test('COMPLETE_SUBTASK accumulates OTSeconds across multiple completions', () => {
  const s1 = focusReducer(baseState({ phase: 'WORK', isOT: true }), {
    type: 'COMPLETE_SUBTASK',
    now: Date.now(),
    subtaskId: 'st-1',
    nextExists: false,
    startAt: '',
    OTSeconds: 30,
  });
  const s2 = focusReducer(s1, {
    type: 'COMPLETE_SUBTASK',
    now: Date.now(),
    subtaskId: 'st-2',
    nextExists: false,
    startAt: '',
    OTSeconds: 45,
  });
  expect(s2.OTSecondsTotal).toBe(75);
});

test('ENTER_OT sets isOT true, stays in WORK', () => {
  const s = focusReducer(baseState({ phase: 'WORK', isOT: false }), {
    type: 'ENTER_OT',
  });
  expect(s.isOT).toBe(true);
  expect(s.phase).toBe('WORK');
});

test('REST_END incrCycles + hasMore READY, records rest log, increments restCycles', () => {
  const phaseStarted = new Date('2026-06-01T12:05:00.000Z').getTime();
  jest.useFakeTimers().setSystemTime(new Date('2026-06-01T12:10:00.000Z'));
  const s = focusReducer(
    baseState({ phase: 'REST', restCycles: 0, phaseStartedAt: phaseStarted }),
    { type: 'REST_END', hasMore: true, incrCycles: true },
  );
  expect(s.phase).toBe('READY');
  expect(s.currentIdx).toBe(1);
  expect(s.restCycles).toBe(1);
  expect(s.restLogs).toHaveLength(1);
  expect(s.restLogs[0].start_at).toBe('2026-06-01T12:05:00.000Z');
  expect(s.restLogs[0].stop_at).toBe('2026-06-01T12:10:00.000Z');
  expect(s.phaseStartedAt).not.toBeNull();
  jest.useRealTimers();
});

test('REST_END incrCycles + no hasMore CONGRATS, records rest log', () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-06-01T12:10:00.000Z'));
  const s = focusReducer(
    baseState({ phase: 'REST', phaseStartedAt: new Date('2026-06-01T12:05:00.000Z').getTime() }),
    { type: 'REST_END', hasMore: false, incrCycles: true },
  );
  expect(s.phase).toBe('CONGRATS');
  expect(s.currentIdx).toBe(0);
  expect(s.restCycles).toBe(1);
  expect(s.restLogs).toHaveLength(1);
  jest.useRealTimers();
});

test('REST_END no incrCycles + hasMore READY, records rest log, no increment, advances idx', () => {
  const s = focusReducer(baseState({ phase: 'REST', restCycles: 0, phaseStartedAt: Date.now() }), {
    type: 'REST_END',
    hasMore: true,
    incrCycles: false,
  });
  expect(s.phase).toBe('READY');
  expect(s.currentIdx).toBe(1);
  expect(s.restCycles).toBe(0);
  expect(s.restLogs).toHaveLength(1);
});

test('REST_END no incrCycles + no hasMore CONGRATS, records rest log, no idx advance', () => {
  const s = focusReducer(baseState({ phase: 'REST', restCycles: 0, phaseStartedAt: Date.now() }), {
    type: 'REST_END',
    hasMore: false,
    incrCycles: false,
  });
  expect(s.phase).toBe('CONGRATS');
  expect(s.currentIdx).toBe(0);
  expect(s.restCycles).toBe(0);
  expect(s.restLogs).toHaveLength(1);
});

test('OPEN_EXIT_REASON captures current phase, sets EXIT_REASON', () => {
  const s = focusReducer(baseState({ phase: 'WORK' }), {
    type: 'OPEN_EXIT_REASON',
  });
  expect(s.phase).toBe('EXIT_REASON');
  expect(s.previousPhase).toBe('WORK');
});

test('OPEN_EXIT_REASON keeps the original phase when the modal is already open', () => {
  const state = baseState({ phase: 'EXIT_REASON', previousPhase: 'WORK' });
  const s = focusReducer(state, { type: 'OPEN_EXIT_REASON' });

  expect(s).toBe(state);
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

test('EXIT_TO_CONGRATS records the active partial focus log', () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-06-01T12:10:00.000Z'));
  const phaseStarted = new Date('2026-06-01T12:05:00.000Z').getTime();
  const s = focusReducer(
    baseState({
      phase: 'WORK',
      phaseStartedAt: phaseStarted,
      completedIds: ['st-1'],
    }),
    {
      type: 'EXIT_TO_CONGRATS',
      subtaskId: 'st-2',
    },
  );
  expect(s.phase).toBe('CONGRATS');
  expect(s.focusLogs).toHaveLength(1);
  expect(s.focusLogs[0]).toEqual({
    subtask_id: 'st-2',
    start_at: '2026-06-01T12:05:00.000Z',
    stop_at: '2026-06-01T12:10:00.000Z',
  });
  jest.useRealTimers();
});

test('ABANDON_SESSION adds partial focus log when in WORK phase', () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-06-01T12:10:00.000Z'));
  const phaseStarted = new Date('2026-06-01T12:05:00.000Z').getTime();
  const s = focusReducer(baseState({ phase: 'WORK', phaseStartedAt: phaseStarted }), {
    type: 'ABANDON_SESSION',
    subtaskId: 'st-3',
    reason: 'urgent',
  });
  expect(s.abandonReason).toBe('urgent');
  expect(s.focusLogs).toHaveLength(1);
  expect(s.focusLogs[0].subtask_id).toBe('st-3');
  expect(s.focusLogs[0].start_at).toBe('2026-06-01T12:05:00.000Z');
  expect(s.focusLogs[0].stop_at).toBe('2026-06-01T12:10:00.000Z');
  jest.useRealTimers();
});

test('ABANDON_SESSION adds partial rest log when in REST phase', () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-06-01T12:10:00.000Z'));
  const phaseStarted = new Date('2026-06-01T12:05:00.000Z').getTime();
  const s = focusReducer(baseState({ phase: 'REST', phaseStartedAt: phaseStarted }), {
    type: 'ABANDON_SESSION',
    subtaskId: null,
    reason: 'break',
  });
  expect(s.abandonReason).toBe('break');
  expect(s.restLogs).toHaveLength(1);
  expect(s.restLogs[0].start_at).toBe('2026-06-01T12:05:00.000Z');
  expect(s.restLogs[0].stop_at).toBe('2026-06-01T12:10:00.000Z');
  jest.useRealTimers();
});

test('ABANDON_SESSION adds no extra logs when in READY phase', () => {
  const s = focusReducer(baseState({ phase: 'READY' }), {
    type: 'ABANDON_SESSION',
    subtaskId: null,
    reason: 'changed mind',
  });
  expect(s.abandonReason).toBe('changed mind');
  expect(s.focusLogs).toHaveLength(0);
  expect(s.restLogs).toHaveLength(0);
});
