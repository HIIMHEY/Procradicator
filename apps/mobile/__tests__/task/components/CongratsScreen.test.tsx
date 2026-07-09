/// <reference types="jest" />

import { fireEvent, render, screen } from '@testing-library/react-native';

import { CongratsScreen } from '@/task/focus_session/components/CongratsScreen';

test('shows congrats text and stats', () => {
  render(
    <CongratsScreen
      completedIds={3}
      totalSubtasks={5}
      onFinish={jest.fn()}
      isPending={false}
    />,
  );
  expect(screen.getByText("Well done. You've made progress.")).toBeTruthy();
  expect(screen.getByText('3/5')).toBeTruthy();
});

test('presses Finish calls onFinish', () => {
  const onFinish = jest.fn();
  render(
    <CongratsScreen
      completedIds={2}
      totalSubtasks={5}
      onFinish={onFinish}
      isPending={false}
    />,
  );
  fireEvent.press(screen.getByText('Finish'));
  expect(onFinish).toHaveBeenCalledTimes(1);
});

test('shows spinner on Finish when isPending', () => {
  render(
    <CongratsScreen
      completedIds={0}
      totalSubtasks={3}
      onFinish={jest.fn()}
      isPending={true}
    />,
  );
  expect(screen.getByTestId('finish-spinner')).toBeTruthy();
});
