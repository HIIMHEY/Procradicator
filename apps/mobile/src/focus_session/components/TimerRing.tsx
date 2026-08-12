import type { ReactNode } from 'react';
import { cssInterop } from 'nativewind';
import Svg, { Circle as RNCircle } from 'react-native-svg';

import { Box } from '@/components/ui/box';

type TimerCircleProps = React.ComponentProps<typeof RNCircle> & {
  className?: string;
  style?: object;
};
const Circle = RNCircle as unknown as React.ComponentType<TimerCircleProps>;

cssInterop(Circle, {
  className: { target: 'style', nativeStyleToProp: { stroke: true } },
});

type TimerRingProps = {
  progress: number;
  ringClassName?: string;
  children?: ReactNode;
};

//Possible move to constants?
const STROKE_WIDTH = 8;
const SIZE = 300;
const R = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

export function TimerRing({
  progress,
  ringClassName = 'stroke-[#FF6B35]',
  children,
}: TimerRingProps) {
  const offset = CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, progress)));

  return (
    <Box className="w-full max-w-[340px] aspect-square items-center justify-center">
      <Svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full h-full">
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          className="stroke-outline-variant"
          strokeWidth={STROKE_WIDTH}
          fill="none"
        />
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          className={ringClassName}
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
