import type { ReactNode } from 'react';
import Svg, { Circle } from 'react-native-svg';

import { Box } from '@/components/ui/box';

type TimerRingProps = {
  progress: number;
  color?: string;
  children?: ReactNode;
};

//Possible move to constants?
const STROKE_WIDTH = 8;
const SIZE = 300;
const R = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

export function TimerRing({ progress, color = '#FF6B35', children }: TimerRingProps) {
  const offset = CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, progress)));

  return (
    <Box className="w-full max-w-[340px] aspect-square items-center justify-center">
      <Svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full h-full">
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          stroke="#E5E7EB"
          strokeWidth={STROKE_WIDTH}
          fill="none"
        />
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          stroke={color}
          strokeWidth={STROKE_WIDTH}
          fill="none"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </Svg>
      {children && <Box className="absolute inset-0 items-center justify-center">{children}</Box>}
    </Box>
  );
}
