/// <reference types="jest" />

import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { TimerRing } from '@/task/focus_session/components/TimerRing';

test('renders children centered inside ring', () => {
  render(
    <TimerRing progress={0.75}>
      <Text>25:00</Text>
    </TimerRing>,
  );
  expect(screen.getByText('25:00')).toBeTruthy();
});

test('accepts custom size and color without error', () => {
  render(<TimerRing progress={0.5} size={150} color="#FF0000" />);
});

test('full progress at 1', () => {
  render(<TimerRing progress={1} />);
});

test('zero progress', () => {
  render(<TimerRing progress={0} />);
});
