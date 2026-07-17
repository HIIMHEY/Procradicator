import { useEffect, useState } from 'react';

export function formatTimer(s: number): string {
  const abs = Math.abs(s);
  const m = Math.floor(abs / 60);
  const sec = abs % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function useTimer(phaseStartedAt: number | null, durationM: number) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!phaseStartedAt) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [phaseStartedAt]);

  if (!phaseStartedAt) {
    return {
      display: formatTimer(durationM * 60),
      remaining: durationM * 60,
      isOT: false,
      progress: 1,
    };
  }

  const elapsed = Math.floor((now - phaseStartedAt) / 1000);
  const remaining = durationM * 60 - elapsed;
  const isOT = remaining <= 0;

  return {
    display: isOT ? `+${formatTimer(-remaining)}` : formatTimer(remaining),
    remaining,
    isOT,
    progress: isOT ? 1 : remaining / (durationM * 60),
  };
}
