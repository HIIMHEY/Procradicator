/// <reference types="jest" />

import { AnalyticsPage } from '@/analytics/components/AnalyticsPage';
import useAnalyticsSummary from '@/analytics/hooks/useAnalyticsSummary';
import { useCurrentUser } from '@/auth/hooks/useCurrentUser';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '../../test-utils/renderWithProviders';

jest.mock('@/analytics/hooks/useAnalyticsSummary');
jest.mock('@/auth/hooks/useCurrentUser');

jest.mock('@/analytics/components/AnalyticsLoadingSkeleton', () => {
  const { View } = jest.requireActual('react-native') as typeof import('react-native');
  return {
    AnalyticsLoadingSkeleton: () => <View testID="mock-analytics-loading" />,
  };
});

jest.mock('@/analytics/components/AnalyticsMetrics', () => {
  const { Text } = jest.requireActual('react-native') as typeof import('react-native');
  return {
    AnalyticsMetrics: ({ totalFocusMinutes }: { totalFocusMinutes: number }) => (
      <Text testID="mock-analytics-metrics">{totalFocusMinutes}</Text>
    ),
  };
});

jest.mock('@/analytics/components/AnalyticsEmptyState', () => {
  const { View } = jest.requireActual('react-native') as typeof import('react-native');
  return {
    AnalyticsEmptyState: () => <View testID="mock-analytics-empty" />,
  };
});

jest.mock('@/analytics/components/AnalyticsErrorState', () => {
  const { Pressable } = jest.requireActual('react-native') as typeof import('react-native');
  return {
    AnalyticsErrorState: ({ onRetry }: { onRetry: () => void }) => (
      <Pressable testID="mock-analytics-error" onPress={onRetry} />
    ),
  };
});

const mockUseAnalyticsSummary = jest.mocked(useAnalyticsSummary);
const mockUseCurrentUser = jest.mocked(useCurrentUser);
const refetch = jest.fn();

const populatedSummary = {
  total_focus_minutes: 240,
  completed_focus_sessions: 8,
  abandoned_focus_sessions: 2,
  total_subtasks: 18,
  completed_subtasks: 12,
  completion_rate: 67,
  average_work_duration_minutes: 25,
  average_rest_duration_minutes: 5,
};

beforeEach(() => {
  refetch.mockReset();
  mockUseAnalyticsSummary.mockReset();
  mockUseCurrentUser.mockReset();
  mockUseCurrentUser.mockReturnValue({ data: { id: 'user-1' } } as never);
});

test('delegates the pending state to the loading component', () => {
  mockUseAnalyticsSummary.mockReturnValue({ isPending: true } as never);
  renderWithProviders(<AnalyticsPage />);
  expect(screen.getByTestId('mock-analytics-loading')).toBeTruthy();
});

test('delegates populated data to the metrics component', () => {
  mockUseAnalyticsSummary.mockReturnValue({
    data: populatedSummary,
    isPending: false,
    isError: false,
  } as never);
  renderWithProviders(<AnalyticsPage />);
  expect(screen.getByTestId('mock-analytics-metrics')).toHaveTextContent('240');
});

test('delegates zero focus history to the empty component', () => {
  mockUseAnalyticsSummary.mockReturnValue({
    data: {
      ...populatedSummary,
      total_focus_minutes: 0,
      completed_focus_sessions: 0,
      abandoned_focus_sessions: 0,
    },
    isPending: false,
    isError: false,
  } as never);
  renderWithProviders(<AnalyticsPage />);
  expect(screen.getByTestId('mock-analytics-empty')).toBeTruthy();
});

test('delegates failures and retry behavior to the error component', () => {
  mockUseAnalyticsSummary.mockReturnValue({
    isPending: false,
    isError: true,
    refetch,
  } as never);
  renderWithProviders(<AnalyticsPage />);
  fireEvent.press(screen.getByTestId('mock-analytics-error'));
  expect(refetch).toHaveBeenCalledTimes(1);
});
