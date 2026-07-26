import { HStack } from '@/components/ui/hstack';
import {
  BriefcaseBusiness,
  ChartPie,
  CircleCheck,
  CircleX,
  Coffee,
  ListChecks,
  Timer,
} from 'lucide-react-native';
import { View } from 'react-native';
import { AnalyticsMetricCard } from './AnalyticsMetricCard';

interface AnalyticsMetricsProps {
  abandonedSessions: number;
  avgRestMin: number;
  avgWorkMin: number;
  completedSessions: number;
  completedSubtasks: number;
  completionRate: number;
  focusMin: number;
  totalSubtasks: number;
}

const formatNumber = (value: number): string =>
  Number.isInteger(value) ? String(value) : String(Number(value.toFixed(1)));

export function AnalyticsMetrics({
  abandonedSessions,
  avgRestMin,
  avgWorkMin,
  completedSessions,
  completedSubtasks,
  completionRate,
  focusMin,
  totalSubtasks,
}: AnalyticsMetricsProps) {
  return (
    <View accessibilityLabel="Analytics metrics" className="w-full gap-2">
      <AnalyticsMetricCard
        accessibilityLabel="Total Focus Time metric"
        icon={Timer}
        label="Total Focus Time"
        value={`${formatNumber(focusMin)} min`}
      />

      <HStack className="w-full gap-2">
        <AnalyticsMetricCard
          accessibilityLabel="Completed metric"
          icon={CircleCheck}
          label="Completed"
          value={formatNumber(completedSessions)}
        />
        <AnalyticsMetricCard
          accessibilityLabel="Abandoned metric"
          icon={CircleX}
          label="Abandoned"
          value={formatNumber(abandonedSessions)}
        />
      </HStack>

      <HStack className="w-full gap-2">
        <AnalyticsMetricCard
          accessibilityLabel="Completion Rate metric"
          icon={ChartPie}
          label="Rate"
          value={`${formatNumber(Math.round(completionRate))}%`}
        />
        <AnalyticsMetricCard
          accessibilityLabel="Subtasks metric"
          icon={ListChecks}
          label="Subtasks"
          value={`${completedSubtasks}/${totalSubtasks}`}
        />
      </HStack>

      <HStack className="w-full gap-2">
        <AnalyticsMetricCard
          accessibilityLabel="Average Work metric"
          icon={BriefcaseBusiness}
          label="Avg Work"
          value={`${formatNumber(avgWorkMin)}m`}
        />
        <AnalyticsMetricCard
          accessibilityLabel="Average Rest metric"
          icon={Coffee}
          label="Avg Rest"
          value={`${formatNumber(avgRestMin)}m`}
        />
      </HStack>
    </View>
  );
}
