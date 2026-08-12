import { fireEvent, render, screen } from '@testing-library/react-native';

import { ExitReasonScreen } from '@/focus_session/components/ExitReasonScreen';

test('shows heading and textarea', () => {
  render(<ExitReasonScreen onSubmit={jest.fn()} onClose={jest.fn()} />);
  expect(screen.getByText('Stay in the Flow?')).toBeTruthy();
  expect(screen.getByPlaceholderText('Why do you have to go?')).toBeTruthy();
});

test('shows validation error when submitting empty reason', () => {
  render(<ExitReasonScreen onSubmit={jest.fn()} onClose={jest.fn()} />);
  fireEvent.press(screen.getByText('Exit'));
  expect(screen.getByText('Reason is required')).toBeTruthy();
});

test('calls onSubmit with valid reason', () => {
  const onSubmit = jest.fn();
  render(<ExitReasonScreen onSubmit={onSubmit} onClose={jest.fn()} />);
  fireEvent.changeText(screen.getByPlaceholderText('Why do you have to go?'), 'Urgent issue');
  fireEvent.press(screen.getByText('Exit'));
  expect(onSubmit).toHaveBeenCalledWith('Urgent issue');
});

test('presses Close calls onClose', () => {
  const onClose = jest.fn();
  render(<ExitReasonScreen onSubmit={jest.fn()} onClose={onClose} />);
  fireEvent.press(screen.getByText('Close'));
  expect(onClose).toHaveBeenCalledTimes(1);
});
