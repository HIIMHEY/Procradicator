import { Box } from '@/components/ui/box';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Leaf } from 'lucide-react-native';
import { View } from 'react-native';

export function AnalyticsEmptyState() {
  return (
    <View
      accessibilityLabel="Analytics empty state"
      className="flex-1 items-center justify-center px-8 pb-24"
    >
      <Box className="h-20 w-20 items-center justify-center rounded-full bg-primary-container">
        <Icon as={Leaf} size="xl" className="text-primary" />
      </Box>
      <Text className="mt-6 text-center text-xl font-medium text-on-surface">A quiet start</Text>
      <Text className="mt-3 max-w-[240px] text-center text-sm leading-5 text-on-surface-variant">
        Complete a session to see your insights here.
      </Text>
    </View>
  );
}
