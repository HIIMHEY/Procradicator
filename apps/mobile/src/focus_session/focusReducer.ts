import { Phase, State } from './schemas';

export const initial: State = {
  phase: 'READY',
  isOT: false,
  sessionId: null,
  currentIdx: 0,
  phaseStartedAt: null,
  workCycleM: 25,
  restCycleM: 5,
  previousPhase: null,
  focusLogs: [],
  restLogs: [],
  completedIds: [],
  workCycles: 0,
  restCycles: 0,
  OTSecondsTotal: 0,
  abandonReason: null,
};

export type Action =
  | { type: 'RESTORE_SESSION'; state: State }
  | {
      type: 'CREATE_SESSION';
      sessionId: string;
      workCycleM: number;
      restCycleM: number;
      currentIdx: number;
    }
  | { type: 'START_WORK' }
  | {
      type: 'COMPLETE_SUBTASK';
      now: number;
      subtaskId: string;
      nextExists: boolean;
      startAt: string;
      OTSeconds: number;
    }
  | { type: 'ENTER_OT' }
  | { type: 'REST_END'; hasMore: boolean; incrCycles: boolean }
  | { type: 'EXIT_TO_CONGRATS'; subtaskId: string | null }
  | { type: 'OPEN_EXIT_REASON' }
  | { type: 'CLOSE_EXIT_REASON' }
  | { type: 'ABANDON_SESSION'; subtaskId: string | null; reason: string };

function closeActiveSegment(state: State, subtaskId: string | null) {
  const now = new Date().toISOString();
  const activePhase = state.phase === 'EXIT_REASON' ? state.previousPhase : state.phase;
  let focusLogs = state.focusLogs;
  let restLogs = state.restLogs;

  if (activePhase === 'WORK' && state.phaseStartedAt && subtaskId) {
    focusLogs = [
      ...focusLogs,
      {
        id: crypto.randomUUID(),
        subtask_id: subtaskId,
        start_at: new Date(state.phaseStartedAt).toISOString(),
        stop_at: now,
      },
    ];
  } else if (activePhase === 'REST' && state.phaseStartedAt) {
    restLogs = [
      ...restLogs,
      {
        id: crypto.randomUUID(),
        start_at: new Date(state.phaseStartedAt).toISOString(),
        stop_at: now,
      },
    ];
  }

  return { focusLogs, restLogs };
}

export function focusReducer(state: State, action: Action): State {
  switch (action.type) {
    case 'RESTORE_SESSION':
      return action.state;

    case 'CREATE_SESSION':
      return {
        ...state,
        sessionId: action.sessionId,
        workCycleM: action.workCycleM,
        restCycleM: action.restCycleM,
        currentIdx: action.currentIdx,
      };

    case 'START_WORK':
      return {
        ...state,
        phase: 'WORK',
        isOT: false,
        phaseStartedAt: Date.now(),
      };

    case 'COMPLETE_SUBTASK': {
      const nextPhase: Phase = !state.isOT && action.nextExists ? 'WORK' : 'REST';
      return {
        ...state,
        phase: nextPhase,
        isOT: false,
        currentIdx: action.nextExists && !state.isOT ? state.currentIdx + 1 : state.currentIdx,
        phaseStartedAt: nextPhase === 'REST' ? Date.now() : state.phaseStartedAt,
        completedIds: [...state.completedIds, action.subtaskId],
        workCycles: state.workCycles + 1,
        OTSecondsTotal: state.OTSecondsTotal + action.OTSeconds,
        focusLogs: [
          ...state.focusLogs,
          {
            id: crypto.randomUUID(),
            subtask_id: action.subtaskId,
            start_at: action.startAt,
            stop_at: new Date(action.now).toISOString(),
          },
        ],
      };
    }

    case 'ENTER_OT':
      return {
        ...state,
        isOT: true,
      };

    case 'REST_END': {
      const now = new Date().toISOString();
      const startAt = state.phaseStartedAt ? new Date(state.phaseStartedAt).toISOString() : now;
      return {
        ...state,
        phase: action.hasMore ? 'READY' : 'CONGRATS',
        currentIdx: action.hasMore ? state.currentIdx + 1 : state.currentIdx,
        restCycles: state.restCycles + (action.incrCycles ? 1 : 0),
        restLogs: [...state.restLogs, { id: crypto.randomUUID(), start_at: startAt, stop_at: now }],
        phaseStartedAt: action.hasMore ? Date.now() : state.phaseStartedAt,
      };
    }

    case 'ABANDON_SESSION': {
      return {
        ...state,
        ...closeActiveSegment(state, action.subtaskId),
        abandonReason: action.reason,
      };
    }

    case 'EXIT_TO_CONGRATS':
      return {
        ...state,
        ...closeActiveSegment(state, action.subtaskId),
        phase: 'CONGRATS',
      };

    case 'OPEN_EXIT_REASON':
      if (state.phase === 'EXIT_REASON') return state;
      return {
        ...state,
        previousPhase: state.phase,
        phase: 'EXIT_REASON',
      };

    case 'CLOSE_EXIT_REASON':
      return {
        ...state,
        phase: state.previousPhase ?? 'READY',
        previousPhase: null,
      };

    default:
      throw new Error(`Unhandled action type: ${JSON.stringify(action)}`);
  }
}

export { Phase, State };
