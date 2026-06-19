/// <reference types="jest" />
import { screen } from '@testing-library/react-native';
import Index from '../../src/app/index';
import { renderWithProviders } from '../../test-utils/renderWithProviders';

const mockFetch = jest.fn();

beforeEach(() => {
  mockFetch.mockReset();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

test('TaskScreen renders the task creation screen', () => {
  renderWithProviders(<Index />);
  expect(screen.getByText('Your Tasks')).toBeTruthy();
  expect(screen.getByText('Create Task')).toBeTruthy();
});
