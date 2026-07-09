/// <reference types="jest" />

import { fireEvent, render, screen } from '@testing-library/react-native';

import { ReadyScreen } from '@/task/focus_session/components/ReadyScreen';

test('shows task title and description', () => {
  render(
    <ReadyScreen
      currentSubtask={{ title: 'Write report', description: 'Complete section 3' }}
      onStart={jest.fn()}
      onExit={jest.fn()}
    />,
  );
  expect(screen.getByText('Write report')).toBeTruthy();
  expect(screen.getByText('Complete section 3')).toBeTruthy();
});

test('presses Start calls onStart', () => {
  const onStart = jest.fn();
  render(
    <ReadyScreen
      currentSubtask={{ title: 'Task', description: 'Desc' }}
      onStart={onStart}
      onExit={jest.fn()}
    />,
  );
  fireEvent.press(screen.getByText('Start'));
  expect(onStart).toHaveBeenCalledTimes(1);
});

test('presses Exit calls onExit', () => {
  const onExit = jest.fn();
  render(
    <ReadyScreen
      currentSubtask={{ title: 'Task', description: 'Desc' }}
      onStart={jest.fn()}
      onExit={onExit}
    />,
  );
  fireEvent.press(screen.getByText('Exit'));
  expect(onExit).toHaveBeenCalledTimes(1);
});
