import { fireEvent, screen } from '@testing-library/react-native';
import dayjs from 'dayjs';
import useDeleteTask from '@/task/hooks/useDeleteTask';
import { TaskItem } from '@/task/task_dashboard/components/TaskItem';
import type { Task } from '@/task/schema';
import { iso, uid } from '../../test-utils/factories';
import { renderWithProviders } from '../../test-utils/renderWithProviders';

const mockNavigate = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ navigate: mockNavigate })),
}));

jest.mock('@/task/hooks/useDeleteTask', () => ({
  __esModule: true,
  default: jest.fn(() => ({ mutate: jest.fn() })),
}));

const dueAt = iso(0);
const taskId = uid('task');

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: taskId,
    title: 'Refine Typography Hierarchy',
    due_at: dueAt,
    description: null,
    updated_at: dueAt,
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
  expect(screen.getByText(dayjs(dueAt).format('MMM D'))).toBeTruthy();
  expect(screen.getByText(dayjs(dueAt).format('hh:mm A'))).toBeTruthy();
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
  expect(mockNavigate).toHaveBeenCalledWith(`/tasks/${taskId}/edit`);
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
