import { fireEvent, screen } from '@testing-library/react-native';
import { API_ROUTES } from '@/config/env';
import TaskIndex from '../../src/app/tasks';
import TaskDetails from '../../src/app/tasks/[id]';
import { iso, session } from '../../test-utils/factories';
import { response } from '../../test-utils/http';
import { renderWithProviders } from '../../test-utils/renderWithProviders';

const mockFetch = jest.fn();
const mockNavigate = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
const taskId = '00000000-0000-4000-8000-000000000001';
const currentSubtaskId = '00000000-0000-4000-8000-000000000003';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: taskId }),
  useRouter: () => ({
    navigate: mockNavigate,
    push: mockPush,
    replace: mockReplace,
  }),
}));

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockReturnValue(new Promise<Response>(() => undefined));
  mockNavigate.mockReset();
  mockPush.mockReset();
  mockReplace.mockReset();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

function showRoadmap() {
  mockFetch.mockResolvedValue(
    response({
      id: taskId,
      title: 'Write project proposal',
      description: 'Prepare the first draft',
      due_at: iso(60),
      updated_at: iso(0),
      version: 1,
      subtasks: [
        {
          id: '00000000-0000-4000-8000-000000000002',
          title: 'Collect requirements',
          description: null,
          next_subtask: [currentSubtaskId],
          is_done: true,
          est_m: 15,
        },
        {
          id: currentSubtaskId,
          title: 'Draft proposal',
          description: 'Write the main sections',
          next_subtask: ['00000000-0000-4000-8000-000000000004'],
          is_done: false,
          est_m: 25,
        },
        {
          id: '00000000-0000-4000-8000-000000000004',
          title: 'Review proposal',
          description: null,
          next_subtask: [],
          is_done: false,
          est_m: 10,
        },
      ],
    }),
  );
  renderWithProviders(<TaskDetails />);
}

test('TaskScreen renders the task dashboard', () => {
  renderWithProviders(<TaskIndex />);
  expect(screen.getByText('Your Tasks')).toBeTruthy();
  expect(screen.getByText('Create')).toBeTruthy();
});

test('task dashboard shows the due time in the user timezone', async () => {
  const previousTimezone = process.env.TZ;
  process.env.TZ = 'Asia/Singapore';
  mockFetch.mockImplementation((input: RequestInfo | URL) => {
    if (String(input) === API_ROUTES.AUTH.ME) {
      return Promise.resolve(response(session()));
    }
    return Promise.resolve(
      response([
        {
          id: taskId,
          title: 'Submit proposal',
          description: null,
          due_at: '2026-08-14T01:48:00',
          updated_at: '2026-08-13T16:00:00Z',
          version: 1,
          subtasks: [],
        },
      ]),
    );
  });
  try {
    renderWithProviders(<TaskIndex />);
    expect(await screen.findByText('09:48 AM')).toBeTruthy();
  } finally {
    if (previousTimezone === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = previousTimezone;
    }
  }
});

test('TaskScreen navigation drawer exposes log out', () => {
  renderWithProviders(<TaskIndex />);
  fireEvent.press(screen.getByLabelText('Open navigation'));
  expect(screen.getByLabelText('Log out')).toBeTruthy();
});

test('TaskScreen opens analytics from the navigation sheet', () => {
  renderWithProviders(<TaskIndex />);
  fireEvent.press(screen.getByLabelText('Open navigation'));
  expect(screen.getByLabelText('Navigation menu')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Go to analytics'));
  expect(mockReplace).toHaveBeenCalledWith('/analytics');
});

test('TaskScreen opens friends from the navigation sheet', () => {
  renderWithProviders(<TaskIndex />);
  fireEvent.press(screen.getByLabelText('Open navigation'));
  fireEvent.press(screen.getByLabelText('Go to friends'));
  expect(mockReplace).toHaveBeenCalledWith('/friends');
});

test('task roadmap shows the task steps and available action', async () => {
  showRoadmap();
  expect(await screen.findByText('Write project proposal')).toBeTruthy();
  expect(screen.getByText('Collect requirements')).toBeTruthy();
  expect(screen.getByText('Draft proposal')).toBeTruthy();
  expect(screen.getByText('Review proposal')).toBeTruthy();
  expect(screen.getAllByText('Start')).toHaveLength(1);
});

test('task roadmap starts the available focus session', async () => {
  showRoadmap();
  fireEvent.press(await screen.findByText('Start'));
  expect(mockNavigate).toHaveBeenCalledWith(`/focus/${currentSubtaskId}?taskId=${taskId}`);
});
