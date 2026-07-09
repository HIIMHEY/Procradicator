import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Box } from '@/components/ui/box';

type Props = {
  progress: number;
  size?: number;
  color?: string;
  children?: ReactNode;
};

export function TimerRing({ progress, size = 200, color = '#FF6B35', children }: Props) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(1, progress)));

  return (
    <Box style={styles.wrapper(size)} className="items-center justify-center">
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E5E7EB"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children && (
        <Box className="absolute items-center justify-center">{children}</Box>
      )}
    </Box>
  );
}

const styles = {
  wrapper: (size: number) => ({ width: size, height: size }),
};
