import { useCurrentUser } from '@/auth/hooks/useCurrentUser';
import { Box } from '@/components/ui/box';
import { Button } from '@/components/ui/button';
import { Icon, MenuIcon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { ScrollView, View } from 'react-native';
import useAnalyticsSummary from '../hooks/useAnalyticsSummary';
import { hasFocusHistory } from '../utils';
import { AnalyticsEmptyState } from './AnalyticsEmptyState';
import { AnalyticsErrorState } from './AnalyticsErrorState';
import { AnalyticsLoadingSkeleton } from './AnalyticsLoadingSkeleton';
import { AnalyticsMetrics } from './AnalyticsMetrics';

interface AnalyticsPageProps {
  onMenuPress?: () => void;
}

export function AnalyticsPage({ onMenuPress }: AnalyticsPageProps) {
  const { data: currentUser } = useCurrentUser();
  const { data, isPending, isError, refetch } = useAnalyticsSummary(currentUser?.id ?? '');

  return (
    <View accessibilityLabel="Analytics page" className="flex-1 bg-[#F8F9FF]">
      <Box className="h-14 w-full flex-row items-center border-b border-slate-200 bg-white px-3">
        <Button
          accessibilityLabel="Back to tasks"
          variant="link"
          onPress={onMenuPress}
          isDisabled={!onMenuPress}
          className="h-10 w-10 items-center justify-center rounded-full p-0"
        >
          <Icon as={MenuIcon} size="sm" className="text-slate-700" />
        </Button>
        <Text className="ml-1 text-base font-medium text-slate-800">Analytics</Text>
      </Box>

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
      ) : !hasFocusHistory(data) ? (
        <AnalyticsEmptyState />
      ) : (
        <ScrollView
          className="flex-1"
          contentInsetAdjustmentBehavior="automatic"
          contentContainerClassName="px-4 py-5"
          showsVerticalScrollIndicator={false}
        >
          <AnalyticsMetrics
            totalFocusMinutes={data.total_focus_minutes}
            completedSessions={data.completed_focus_sessions}
            abandonedSessions={data.abandoned_focus_sessions}
            totalSubtasks={data.total_subtasks}
            completedSubtasks={data.completed_subtasks}
            completionRate={data.completion_rate}
            averageWorkMinutes={data.average_work_duration_minutes}
            averageRestMinutes={data.average_rest_duration_minutes}
          />
        </ScrollView>
      )}
    </View>
  );
}
