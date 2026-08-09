/// <reference types="jest" />
import { fireEvent, screen } from '@testing-library/react-native';
import useDeleteTask from '@/task/hooks/useDeleteTask';
import { TaskItem } from '@/task/task_dashboard/components/TaskItem';
import type { Task } from '@/task/schema';
import { renderWithProviders } from '../../test-utils/renderWithProviders';

const mockNavigate = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ navigate: mockNavigate })),
}));

jest.mock('@/task/hooks/useDeleteTask', () => ({
  __esModule: true,
  default: jest.fn(() => ({ mutate: jest.fn() })),
}));

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: '7cf2a63f-45da-4af7-9917-306abc624759',
    title: 'Refine Typography Hierarchy',
    due_at: '2026-10-25T14:00:00',
    description: null,
    updated_at: '2026-10-20T10:00:00',
    version: 0,
    subtasks: [],
    ...overrides,
  };
}

beforeEach(() => {
  mockNavigate.mockReset();
});

test('renders the task title with its due date and time', () => {
  renderWithProviders(<TaskItem task={makeTask()} />);
  expect(screen.getByText('Refine Typography Hierarchy')).toBeTruthy();
  expect(screen.getByText('Oct 25')).toBeTruthy();
  expect(screen.getByText('02:00 PM')).toBeTruthy();
});

test('grip handle toggles the edit and delete actions', () => {
  renderWithProviders(<TaskItem task={makeTask()} />);
  expect(screen.queryByLabelText('Edit task')).toBeNull();
  expect(screen.queryByLabelText('Delete task')).toBeNull();
  fireEvent.press(screen.getByLabelText('Toggle task actions'));
  expect(screen.getByLabelText('Edit task')).toBeTruthy();
  expect(screen.getByLabelText('Delete task')).toBeTruthy();
});

test('edit action navigates to the task edit route', () => {
  renderWithProviders(<TaskItem task={makeTask()} />);
  fireEvent.press(screen.getByLabelText('Toggle task actions'));
  fireEvent.press(screen.getByLabelText('Edit task'));
  expect(mockNavigate).toHaveBeenCalledWith('/tasks/7cf2a63f-45da-4af7-9917-306abc624759/edit');
});

test('delete action invokes the delete mutation', () => {
  const mutate = jest.fn();
  jest
    .mocked(useDeleteTask)
    .mockReturnValue({ mutate } as unknown as ReturnType<typeof useDeleteTask>);
  renderWithProviders(<TaskItem task={makeTask()} />);
  fireEvent.press(screen.getByLabelText('Toggle task actions'));
  fireEvent.press(screen.getByLabelText('Delete task'));
  expect(mutate).toHaveBeenCalled();
});
