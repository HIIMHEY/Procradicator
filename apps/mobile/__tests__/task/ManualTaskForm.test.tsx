/// <reference types="jest" />

import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react-native';
import { ManualTaskForm } from '../../src/features/task/components/ManualTaskForm';

test('ManualTaskForm lets user add, move, and delete manual subtasks', () => {
  render(<ManualTaskForm isSubmitting={false} onSubmit={jest.fn()} />);
  fireEvent.changeText(
    screen.getByPlaceholderText('Example: Read assignment brief'),
    'Submit README',
  );
  fireEvent.press(screen.getByText('Add'));
  expect(screen.getByText('4. Submit README')).toBeTruthy();
  fireEvent.press(screen.getAllByText('Up')[3]);
  expect(screen.getByText('3. Submit README')).toBeTruthy();
  fireEvent.press(screen.getAllByText('Delete')[2]);
  expect(screen.queryByText('3. Submit README')).toBeNull();
});

test('ManualTaskForm shows validation error when title is empty', async () => {
  const onSubmit = jest.fn();
  render(<ManualTaskForm isSubmitting={false} onSubmit={onSubmit} />);
  fireEvent.changeText(screen.getByPlaceholderText('Example: Finish Milestone 1'), '');
  fireEvent.press(screen.getByText('Create roadmap'));
  expect(await screen.findByText('Enter a task title.')).toBeTruthy();
  expect(onSubmit).not.toHaveBeenCalled();
});
