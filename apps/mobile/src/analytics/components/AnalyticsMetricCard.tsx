import { Box } from '@/components/ui/box';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

interface AnalyticsMetricCardProps {
  accessibilityLabel: string;
  icon: LucideIcon;
  label: string;
  value: string;
}

export function AnalyticsMetricCard({
  accessibilityLabel,
  icon,
  label,
  value,
}: AnalyticsMetricCardProps) {
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      className="min-h-[88px] flex-1 justify-center rounded-xl border border-slate-200 bg-white px-3 py-3"
    >
      <Box className="flex-row items-center gap-2">
        <Box className="h-7 w-7 items-center justify-center rounded-lg bg-blue-50">
          <Icon as={icon} size="sm" className="text-blue-600" />
        </Box>
        <Text className="flex-1 text-sm text-slate-600">{label}</Text>
      </Box>
      <Text className="mt-1 text-xl font-medium text-blue-600">{value}</Text>
    </View>
  );
}
