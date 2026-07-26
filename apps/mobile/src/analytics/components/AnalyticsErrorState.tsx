import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { CircleAlert } from 'lucide-react-native';
import { View } from 'react-native';

interface AnalyticsErrorStateProps {
  onRetry: () => void;
}

export function AnalyticsErrorState({ onRetry }: AnalyticsErrorStateProps) {
  return (
    <View
      accessibilityLabel="Analytics error state"
      className="flex-1 items-center justify-center px-8 pb-24"
    >
      <Box className="h-20 w-20 items-center justify-center rounded-full bg-blue-50">
        <Icon as={CircleAlert} size="xl" className="text-slate-500" />
      </Box>
      <Text className="mt-6 text-center text-base font-medium text-slate-900">
        Something went wrong
      </Text>
      <Text className="mt-3 max-w-[240px] text-center text-sm leading-5 text-slate-500">
        We&apos;re having trouble loading your stats right now.
      </Text>
      <Button
        accessibilityLabel="Retry analytics"
        variant="outline"
        size="sm"
        onPress={onRetry}
        className="mt-6 rounded-full border-slate-200 bg-white px-6"
      >
        <ButtonText className="text-blue-600">Retry</ButtonText>
      </Button>
    </View>
  );
}
