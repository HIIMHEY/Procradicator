/// <reference types="jest" />
import { fireEvent, screen } from '@testing-library/react-native';
import TaskIndex from '../../src/app/tasks';
import { renderWithProviders } from '../../test-utils/renderWithProviders';

const mockFetch = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
}));

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockReturnValue(new Promise<Response>(() => undefined));
  mockPush.mockReset();
  mockReplace.mockReset();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

test('TaskScreen renders the task dashboard', () => {
  renderWithProviders(<TaskIndex />);
  expect(screen.getByText('Your Tasks')).toBeTruthy();
  expect(screen.getByText('Create Task')).toBeTruthy();
});

test('TaskScreen opens analytics from the navigation sheet', () => {
  renderWithProviders(<TaskIndex />);
  fireEvent.press(screen.getByLabelText('Open navigation'));
  expect(screen.getByLabelText('Navigation menu')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Go to analytics'));
  expect(mockReplace).toHaveBeenCalledWith('/analytics');
});
