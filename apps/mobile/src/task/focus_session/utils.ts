import type { FocusSession, FocusSessionState } from './schemas';

export const getSearchParam = (value: string | string[] | undefined): string => {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  return value ?? '';
};

export const formatTimer = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => value.toString().padStart(2, '0')).join(':');
};

export const calculateRemainingSeconds = (
  durationMinutes: number,
  phaseStartedAt: string | null,
): number => {
  const durationSeconds = durationMinutes * 60;
  if (!phaseStartedAt) {
    return durationSeconds;
  }
  const elapsedSeconds = Math.floor((Date.now() - new Date(phaseStartedAt).getTime()) / 1000);
  return Math.max(0, Math.min(durationSeconds, durationSeconds - elapsedSeconds));
};

export const isTimedFocusState = (state: FocusSessionState): boolean =>
  state === 'WORKING' || state === 'RESTING';

export const getSessionRemainingSeconds = (focusSession: FocusSession): number => {
  if (focusSession.state === 'WORKING') {
    return calculateRemainingSeconds(
      focusSession.work_duration_minutes,
      focusSession.phase_started_at,
    );
  }
  if (focusSession.state === 'RESTING') {
    return calculateRemainingSeconds(
      focusSession.rest_duration_minutes,
      focusSession.phase_started_at,
    );
  }
  return 0;
};

export const getTimerMode = (state: FocusSessionState): 'work' | 'rest' => {
  if (state === 'RESTING' || state === 'REST_COMPLETE') {
    return 'rest';
  }
  return 'work';
};
