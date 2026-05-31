/// <reference types="jest" />

import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react-native';
import { ManualTaskForm } from '../../src/features/task/components/ManualTaskForm';

test('ManualTaskForm lets user add, move, and delete manual subtasks', () => {
  render(<ManualTaskForm isSubmitting={false} onSubmit={jest.fn()} />);
  const input = screen.getByPlaceholderText('Example: Read assignment brief');
  fireEvent.changeText(input, 'Draft README');
  fireEvent.press(screen.getByText('Add'));
  fireEvent.changeText(input, 'Submit README');
  fireEvent.press(screen.getByText('Add'));
  expect(screen.getByText('2. Submit README')).toBeTruthy();
  fireEvent.press(screen.getAllByText('Up')[1]);
  expect(screen.getByText('1. Submit README')).toBeTruthy();
  fireEvent.press(screen.getAllByText('Delete')[0]);
  expect(screen.queryByText('1. Submit README')).toBeNull();
});

test('ManualTaskForm shows validation error when title is empty', async () => {
  const onSubmit = jest.fn();
  render(<ManualTaskForm isSubmitting={false} onSubmit={onSubmit} />);
  fireEvent.changeText(screen.getByPlaceholderText('Example: Finish Milestone 1'), '');
  fireEvent.press(screen.getByText('Create roadmap'));
  expect(await screen.findByText('Enter a task title.')).toBeTruthy();
  expect(onSubmit).not.toHaveBeenCalled();
});
