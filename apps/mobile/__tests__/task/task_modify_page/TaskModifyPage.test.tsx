import '../../../test-utils/mockDraglist';
import { ModifyTaskPage } from '@/task/task_modify_page/components/TaskModifyPage';
import { Task } from '@/task/schema';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { iso, uid } from '../../../test-utils/factories';
import { renderWithProviders } from '../../../test-utils/renderWithProviders';

const mockTaskId = uid('task');
const mockFirstSubtaskId = uid('subtask-1');
const mockSecondSubtaskId = uid('subtask-2');

const mockReplace = jest.fn();
const mockUpdateMutate = jest.fn();
const mockCreateMutate = jest.fn();

let mockEditMode = true;

const mockTaskData: Task = {
  id: mockTaskId,
  title: 'Deep Work Session',
  description: 'Focusing on the architectural redesign.',
  due_at: iso(0),
  updated_at: iso(0),
  version: 1,
  subtasks: [
    {
      id: mockFirstSubtaskId,
      title: 'vRefactor State Management',
      description: '',
      next_subtask: [mockSecondSubtaskId],
      is_done: false,
      est_m: 150,
      deleted_at: null,
    },
    {
      id: mockSecondSubtaskId,
      title: 'Update API Endpoints',
      description: '',
      next_subtask: [],
      is_done: false,
      est_m: 105,
      deleted_at: null,
    },
  ],
  deleted_at: null,
};

const mockEmptyReadResult = {
  data: undefined,
  isPending: false,
  isError: false,
  error: null,
  refetch: jest.fn(),
};
const mockTaskReadResult = {
  data: mockTaskData,
  isPending: false,
  isError: false,
  error: null,
  refetch: jest.fn(),
};

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: mockEditMode ? mockTaskId : undefined }),
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

jest.mock('@/task/hooks/useReadTask', () => ({
  __esModule: true,
  default: jest.fn(() => (mockEditMode ? mockTaskReadResult : mockEmptyReadResult)),
}));

jest.mock('@/task/hooks/useCreateTask', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    mutate: mockCreateMutate,
    isPending: false,
  })),
}));

jest.mock('@/task/hooks/useUpdateTask', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    mutate: mockUpdateMutate,
    isPending: false,
  })),
}));

beforeEach(() => {
  mockEditMode = true;
  mockReplace.mockReset();
  mockUpdateMutate.mockReset();
  mockCreateMutate.mockReset();
});

afterEach(() => {
  mockTaskData.subtasks[0].description = '';
});

describe('ModifyTaskPage', () => {
  it('renders the shared header with the manual tab active', () => {
    renderWithProviders(<ModifyTaskPage mode="Edit" />);
    expect(screen.getByLabelText('Close task editor')).toBeTruthy();
    expect(screen.getByLabelText('Manual task mode')).toBeSelected();
    expect(screen.getByLabelText('AI chat mode')).not.toBeSelected();
  });

  it('renders the form fields prefilled with task data', async () => {
    renderWithProviders(<ModifyTaskPage mode="Edit" />);
    expect(await screen.findByDisplayValue('Deep Work Session')).toBeTruthy();
    expect(screen.getByDisplayValue('Focusing on the architectural redesign.')).toBeTruthy();
  });

  it('renders subtask cards with estimates on the timeline', async () => {
    renderWithProviders(<ModifyTaskPage mode="Edit" />);
    expect(await screen.findByText('vRefactor State Management')).toBeTruthy();
    expect(screen.getByText('Est: 2h 30m')).toBeTruthy();
    expect(screen.getByText('Update API Endpoints')).toBeTruthy();
    expect(screen.getByText('Est: 1h 45m')).toBeTruthy();
  });

  it('renders the add subtask button and the save button', async () => {
    renderWithProviders(<ModifyTaskPage mode="Edit" />);
    expect(await screen.findByLabelText('Add Subtask')).toBeTruthy();
    expect(screen.getByText('Save Changes')).toBeTruthy();
  });

  it('close button navigates back to the task list', async () => {
    renderWithProviders(<ModifyTaskPage mode="Edit" />);
    fireEvent.press(await screen.findByLabelText('Close task editor'));
    expect(mockReplace).toHaveBeenCalledWith('/tasks');
  });

  it('AI tab navigates to the AI chat route', async () => {
    renderWithProviders(<ModifyTaskPage mode="Edit" />);
    fireEvent.press(await screen.findByLabelText('AI chat mode'));
    expect(mockReplace).toHaveBeenCalledWith(`/tasks/${mockTaskId}/edit/chat`);
  });

  it('radio node toggles the subtask done state', async () => {
    renderWithProviders(<ModifyTaskPage mode="Edit" />);
    const node = await screen.findByLabelText('Toggle subtask 1 done');
    expect(node).not.toBeChecked();
    fireEvent.press(node);
    expect(screen.getByLabelText('Toggle subtask 1 done')).toBeChecked();
  });

  it('edit action expands the subtask into its edit form', async () => {
    renderWithProviders(<ModifyTaskPage mode="Edit" />);
    fireEvent.press(await screen.findByLabelText('Edit subtask 1'));
    expect(screen.getByPlaceholderText('Enter something you have to do...')).toBeTruthy();
  });

  it('delete action removes a subtask card', async () => {
    renderWithProviders(<ModifyTaskPage mode="Edit" />);
    fireEvent.press(await screen.findByLabelText('Delete subtask 2'));
    expect(screen.queryByText('Update API Endpoints')).toBeNull();
  });

  it('add subtask appends a new card to the timeline', async () => {
    renderWithProviders(<ModifyTaskPage mode="Edit" />);
    fireEvent.press(await screen.findByLabelText('Add Subtask'));
    expect(screen.getByText('To do number 3 ...')).toBeTruthy();
  });

  it('save changes submits the updated task', async () => {
    renderWithProviders(<ModifyTaskPage mode="Edit" />);
    const title = await screen.findByDisplayValue('Deep Work Session');
    fireEvent.changeText(title, 'Deep Work Session v2');
    fireEvent.press(screen.getByText('Save Changes'));
    await waitFor(() => expect(mockUpdateMutate).toHaveBeenCalled());
  });

  it('saves cleanly when a subtask description is null', async () => {
    mockTaskData.subtasks[0].description = null;
    renderWithProviders(<ModifyTaskPage mode="Edit" />);
    fireEvent.press(screen.getByText('Save Changes'));
    await waitFor(() => expect(mockUpdateMutate).toHaveBeenCalled());
  });

  it('create mode keeps save disabled until a subtask is added', () => {
    mockEditMode = false;
    renderWithProviders(<ModifyTaskPage mode="Create" />);
    expect(screen.getByText('Create Task')).toBeDisabled();
    fireEvent.press(screen.getByLabelText('Add Subtask'));
    expect(screen.getByText('Create Task')).not.toBeDisabled();
  });
});
