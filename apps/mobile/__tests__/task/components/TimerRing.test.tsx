/// <reference types="jest" />

import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { TimerRing } from '@/focus_session/components/TimerRing';

test('renders children centered inside ring', () => {
  render(
    <TimerRing progress={0.75}>
      <Text>25:00</Text>
    </TimerRing>,
  );
  expect(screen.getByText('25:00')).toBeTruthy();
});

test('accepts custom color without error', () => {
  render(<TimerRing progress={0.5} color="red" />);
});

test('full progress at 1', () => {
  render(<TimerRing progress={1} />);
});

test('zero progress', () => {
  render(<TimerRing progress={0} />);
});
