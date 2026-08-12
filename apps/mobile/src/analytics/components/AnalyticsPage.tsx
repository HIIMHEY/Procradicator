import { useCurrentUser } from '@/auth/hooks/useCurrentUser';
import { NavBar } from '@/navigation/components/NavBar';
import { ScrollView, View } from 'react-native';
import useAnalyticsSummary from '../hooks/useAnalyticsSummary';
import { AnalyticsEmptyState } from './AnalyticsEmptyState';
import { AnalyticsErrorState } from './AnalyticsErrorState';
import { AnalyticsLoadingSkeleton } from './AnalyticsLoadingSkeleton';
import { AnalyticsMetrics } from './AnalyticsMetrics';

export function AnalyticsPage() {
  const { data: currentUser } = useCurrentUser();
  const { data, isPending, isError, refetch } = useAnalyticsSummary(currentUser?.id ?? '');
  const hasHistory =
    data && (data.focus_min > 0 || data.completed_sessions > 0 || data.abandoned_sessions > 0);

  return (
    <View accessibilityLabel="Analytics page" className="flex-1 bg-background">
      <NavBar active="analytics" title="Analytics" />

      {isPending ? (
        <ScrollView
          className="flex-1"
          contentInsetAdjustmentBehavior="automatic"
          contentContainerClassName="px-4 py-5"
          showsVerticalScrollIndicator={false}
        >
          <AnalyticsLoadingSkeleton />
        </ScrollView>
      ) : isError || !data ? (
        <AnalyticsErrorState onRetry={refetch} />
      ) : !hasHistory ? (
        <AnalyticsEmptyState />
      ) : (
        <ScrollView
          className="flex-1"
          contentInsetAdjustmentBehavior="automatic"
          contentContainerClassName="px-4 py-5"
          showsVerticalScrollIndicator={false}
        >
          <AnalyticsMetrics
            focusMin={data.focus_min}
            completedSessions={data.completed_sessions}
            abandonedSessions={data.abandoned_sessions}
            totalSubtasks={data.total_subtasks}
            completedSubtasks={data.completed_subtasks}
            completionRate={data.completion_rate}
            avgWorkMin={data.avg_work_min}
            avgRestMin={data.avg_rest_min}
          />
        </ScrollView>
      )}
    </View>
  );
}
