/// <reference types="jest" />

import { fireEvent, render, screen } from '@testing-library/react-native';

import { RestScreen } from '@/task/focus_session/components/RestScreen';

test('shows Rest Well heading and timer', () => {
  render(
    <RestScreen
      timer={{ display: '05:00', remaining: 300, isOT: false, progress: 1 }}
      onSkip={jest.fn()}
    />,
  );
  expect(screen.getByText('Rest Well')).toBeTruthy();
  expect(screen.getByText('05:00')).toBeTruthy();
});

test('presses Skip calls onSkip', () => {
  const onSkip = jest.fn();
  render(
    <RestScreen
      timer={{ display: '05:00', remaining: 300, isOT: false, progress: 1 }}
      onSkip={onSkip}
    />,
  );
  fireEvent.press(screen.getByText('Skip'));
  expect(onSkip).toHaveBeenCalledTimes(1);
});

test('does NOT show Exit button', () => {
  render(
    <RestScreen
      timer={{ display: '05:00', remaining: 300, isOT: false, progress: 1 }}
      onSkip={jest.fn()}
    />,
  );
  expect(screen.queryByText('Exit')).toBeNull();
});
