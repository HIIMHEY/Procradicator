export type Phase = 'READY' | 'WORK' | 'REST' | 'CONGRATS' | 'EXIT_REASON';

export type State = {
  phase: Phase;
  isOT: boolean;
  sessionId: string | null;
  currentIdx: number;
  phaseStartedAt: number | null;
  workCycleM: number;
  restCycleM: number;
  previousPhase: Phase | null;
  focusLogs: Array<{ subtask_id: string; start_at: string; stop_at: string }>;
  restLogs: Array<{ start_at: string; stop_at: string }>;
  completedIds: string[];
  workCycles: number;
  restCycles: number;
  OTSecondsTotal: number;
};

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
};

export type Action =
  | { type: 'SESSION_CREATED'; sessionId: string; workCycleM: number; restCycleM: number }
  | { type: 'SESSION_RECOVERED'; sessionId: string; workCycleM: number; restCycleM: number; workCycles: number; restCycles: number }
  | { type: 'START_WORK' }
  | { type: 'SUBTASK_COMPLETED'; now: number; subtaskId: string; nextExists: boolean; startAt: string }
  | { type: 'ENTER_OT' }
  | { type: 'REST_COMPLETE'; hasMore: boolean }
  | { type: 'EXIT_TO_CONGRATS' }
  | { type: 'OPEN_EXIT_REASON' }
  | { type: 'CLOSE_EXIT_REASON' };

function unreachable(x: never): never {
  throw new Error(`Unhandled action type: ${JSON.stringify(x)}`);
}

export function focusReducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SESSION_CREATED':
      return {
        ...state,
        sessionId: action.sessionId,
        workCycleM: action.workCycleM,
        restCycleM: action.restCycleM,
      };

    case 'SESSION_RECOVERED':
      return {
        ...state,
        sessionId: action.sessionId,
        workCycleM: action.workCycleM,
        restCycleM: action.restCycleM,
        workCycles: action.workCycles,
        restCycles: action.restCycles,
      };

    case 'START_WORK':
      return {
        ...state,
        phase: 'WORK',
        isOT: false,
        phaseStartedAt: Date.now(),
      };

    case 'SUBTASK_COMPLETED': {
      const isOT = state.isOT;
      const nextPhase: Phase = isOT
        ? 'REST'
        : action.nextExists
          ? 'WORK'
          : 'CONGRATS';
      return {
        ...state,
        phase: nextPhase,
        isOT: false,
        currentIdx: action.nextExists && !isOT ? state.currentIdx + 1 : state.currentIdx,
        phaseStartedAt: nextPhase === 'WORK' || nextPhase === 'REST'
          ? Date.now()
          : state.phaseStartedAt,
        completedIds: [...state.completedIds, action.subtaskId],
        workCycles: state.workCycles + 1,
        focusLogs: [
          ...state.focusLogs,
          {
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

    case 'REST_COMPLETE':
      return {
        ...state,
        phase: action.hasMore ? 'READY' : 'CONGRATS',
        restCycles: state.restCycles + 1,
        phaseStartedAt: action.hasMore ? Date.now() : state.phaseStartedAt,
      };

    case 'EXIT_TO_CONGRATS':
      return {
        ...state,
        phase: 'CONGRATS',
      };

    case 'OPEN_EXIT_REASON':
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
      return unreachable(action);
  }
}
