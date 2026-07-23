/// <reference types="jest" />

import { fireEvent, render, screen } from '@testing-library/react-native';

import { CongratsScreen } from '@/focus_session/components/CongratsScreen';

test('shows congrats text and focus time', () => {
  render(<CongratsScreen focusTimeM={42} onFinish={jest.fn()} />);
  expect(screen.getByText("Well done! You've made progress.")).toBeTruthy();
  expect(screen.getByText('Focus Time')).toBeTruthy();
  expect(screen.getByText('42')).toBeTruthy();
});

test('presses Finish Task calls onFinish', () => {
  const onFinish = jest.fn();
  render(<CongratsScreen focusTimeM={30} onFinish={onFinish} />);
  fireEvent.press(screen.getByText('Finish Task'));
  expect(onFinish).toHaveBeenCalledTimes(1);
});
