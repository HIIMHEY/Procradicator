/// <reference types="jest" />

import { fireEvent, render, screen } from '@testing-library/react-native';

import { ReadyScreen } from '@/focus_session/components/ReadyScreen';

test('shows task title and description', () => {
  render(
    <ReadyScreen
      currentSubtask={{ title: 'Write report', description: 'Complete section 3' }}
      workCycleM={25}
      onStart={jest.fn()}
      onExit={jest.fn()}
    />,
  );
  expect(screen.getByText('Write report')).toBeTruthy();
  expect(screen.getByText('Complete section 3')).toBeTruthy();
});

test('displays formatted work duration', () => {
  render(
    <ReadyScreen
      currentSubtask={{ title: 'Code', description: 'Desc' }}
      workCycleM={45}
      onStart={jest.fn()}
      onExit={jest.fn()}
    />,
  );
  expect(screen.getByText('45:00')).toBeTruthy();
});

test('presses Start calls onStart', () => {
  const onStart = jest.fn();
  render(
    <ReadyScreen
      currentSubtask={{ title: 'Task', description: 'Desc' }}
      workCycleM={25}
      onStart={onStart}
      onExit={jest.fn()}
    />,
  );
  fireEvent.press(screen.getByText('Start'));
  expect(onStart).toHaveBeenCalledTimes(1);
});

test('presses Exit Focus calls onExit', () => {
  const onExit = jest.fn();
  render(
    <ReadyScreen
      currentSubtask={{ title: 'Task', description: 'Desc' }}
      workCycleM={25}
      onStart={jest.fn()}
      onExit={onExit}
    />,
  );
  fireEvent.press(screen.getByText('Exit Focus'));
  expect(onExit).toHaveBeenCalledTimes(1);
});
