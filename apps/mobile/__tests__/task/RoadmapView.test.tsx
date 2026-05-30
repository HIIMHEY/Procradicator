/// <reference types="jest" />

import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react-native';
import { RoadmapView } from '../../src/features/task/components/RoadmapView';
import { manualTask } from '../../test-utils/taskTestData';

test('RoadmapView displays roadmap nodes and progress', () => {
  render(<RoadmapView isUpdating={false} task={manualTask} onToggleSubtask={jest.fn()} />);
  expect(screen.getByText('Roadmap From API')).toBeTruthy();
  expect(screen.getByText('Open brief')).toBeTruthy();
  expect(screen.getByText('Write first draft')).toBeTruthy();
  expect(screen.getByText('0 of 2 complete (0%)')).toBeTruthy();
});

test('RoadmapView calls toggle handler when subtask is pressed', () => {
  const onToggleSubtask = jest.fn();
  render(<RoadmapView isUpdating={false} task={manualTask} onToggleSubtask={onToggleSubtask} />);
  fireEvent.press(screen.getByText('Open brief'));
  expect(onToggleSubtask).toHaveBeenCalledWith('subtask-1');
});
