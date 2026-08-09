import { TaskModeSwitcher } from '@/task/components/TaskModeSwitcher';
import { fireEvent, screen } from '@testing-library/react-native';
import { uid } from '../../../test-utils/factories';
import { renderWithProviders } from '../../../test-utils/renderWithProviders';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

const mockTaskId = uid('task');

beforeEach(() => {
  mockReplace.mockReset();
});

describe('TaskModeSwitcher', () => {
  it('marks the manual tab selected and the AI tab unselected in manual mode', () => {
    renderWithProviders(<TaskModeSwitcher taskId={mockTaskId} active="manual" />);
    expect(screen.getByLabelText('Manual task mode')).toBeSelected();
    expect(screen.getByLabelText('AI chat mode')).not.toBeSelected();
  });

  it('marks the AI tab selected and the manual tab unselected in AI mode', () => {
    renderWithProviders(<TaskModeSwitcher taskId={mockTaskId} active="ai" />);
    expect(screen.getByLabelText('Manual task mode')).not.toBeSelected();
    expect(screen.getByLabelText('AI chat mode')).toBeSelected();
  });

  it('switches to the AI chat route from edit mode', () => {
    renderWithProviders(<TaskModeSwitcher taskId={mockTaskId} active="manual" />);
    fireEvent.press(screen.getByLabelText('AI chat mode'));
    expect(mockReplace).toHaveBeenCalledWith(`/tasks/${mockTaskId}/edit/chat`);
  });

  it('switches back to the manual form from edit mode', () => {
    renderWithProviders(<TaskModeSwitcher taskId={mockTaskId} active="ai" />);
    fireEvent.press(screen.getByLabelText('Manual task mode'));
    expect(mockReplace).toHaveBeenCalledWith(`/tasks/${mockTaskId}/edit`);
  });

  it('uses create routes when there is no task id', () => {
    renderWithProviders(<TaskModeSwitcher active="manual" />);
    fireEvent.press(screen.getByLabelText('AI chat mode'));
    expect(mockReplace).toHaveBeenCalledWith('/tasks/create/chat');
  });

  it('switches to the create form from AI create mode', () => {
    renderWithProviders(<TaskModeSwitcher active="ai" />);
    fireEvent.press(screen.getByLabelText('Manual task mode'));
    expect(mockReplace).toHaveBeenCalledWith('/tasks/create');
  });
});
