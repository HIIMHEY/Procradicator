/// <reference types="jest" />

import { fireEvent, render, screen } from '@testing-library/react-native';

import { WorkScreen } from '@/focus_session/components/WorkScreen';

const baseTimer = {
  display: '25:00',
  remaining: 1500,
  isOT: false,
  progress: 1,
};

test('shows task heading and timer display', () => {
  render(
    <WorkScreen
      currentSubtask={{ title: 'Code', description: 'Implement feature' }}
      timer={baseTimer}
      onComplete={jest.fn()}
      onExit={jest.fn()}
    />,
  );
  expect(screen.getByText('Code')).toBeTruthy();
  expect(screen.getByText('25:00')).toBeTruthy();
});

test('presses Complete Subtask calls onComplete', () => {
  const onComplete = jest.fn();
  render(
    <WorkScreen
      currentSubtask={{ title: 'Code', description: 'Desc' }}
      timer={baseTimer}
      onComplete={onComplete}
      onExit={jest.fn()}
    />,
  );
  fireEvent.press(screen.getByText('Complete Subtask'));
  expect(onComplete).toHaveBeenCalledTimes(1);
});

test('shows overtime label and amber when isOT', () => {
  render(
    <WorkScreen
      currentSubtask={{ title: 'Code', description: 'Desc' }}
      timer={{ display: '+05:00', remaining: -300, isOT: true, progress: 1 }}
      onComplete={jest.fn()}
      onExit={jest.fn()}
    />,
  );
  expect(screen.queryByText('Overtime')).toBeTruthy();
});

test('presses Exit Focus calls onExit', () => {
  const onExit = jest.fn();
  render(
    <WorkScreen
      currentSubtask={{ title: 'Code', description: 'Desc' }}
      timer={baseTimer}
      onComplete={jest.fn()}
      onExit={onExit}
    />,
  );
  fireEvent.press(screen.getByText('Exit Focus'));
  expect(onExit).toHaveBeenCalledTimes(1);
});
