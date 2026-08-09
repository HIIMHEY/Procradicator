import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { CircleAlert, UserRound } from 'lucide-react-native';
import { View } from 'react-native';

interface FriendEmptyProps {
  description: string;
  label: string;
  title: string;
}

interface FriendErrorProps {
  label: string;
  onRetry: () => void;
  retryLabel: string;
}

export function FriendLoading({ label }: { label: string }) {
  return (
    <View accessibilityLabel={label} className="flex-1 gap-3 px-5 pb-8">
      {[1, 2, 3].map((item) => (
        <Box
          key={item}
          className="min-h-20 flex-row items-center rounded-xl bg-surface-container-low px-4 py-3"
        >
          <SkeletonText _lines={1} className="h-4 w-32 rounded bg-surface-container-high" />
          <Skeleton
            variant="rounded"
            className="ml-auto h-10 w-20 rounded-xl bg-surface-container-high"
          />
        </Box>
      ))}
    </View>
  );
}

export function FriendEmpty({ description, label, title }: FriendEmptyProps) {
  return (
    <View accessibilityLabel={label} className="flex-1 items-center justify-center px-8 pb-24">
      <Box className="h-20 w-20 items-center justify-center rounded-full bg-primary-container">
        <Icon as={UserRound} size="xl" className="text-primary" />
      </Box>
      <Text className="mt-6 text-center text-xl font-medium text-on-surface">{title}</Text>
      <Text className="mt-3 max-w-64 text-center text-sm leading-5 text-on-surface-variant">
        {description}
      </Text>
    </View>
  );
}

export function FriendError({ label, onRetry, retryLabel }: FriendErrorProps) {
  return (
    <View accessibilityLabel={label} className="flex-1 items-center justify-center px-8 pb-24">
      <Box className="h-20 w-20 items-center justify-center rounded-full bg-primary-container">
        <Icon as={CircleAlert} size="xl" className="text-on-surface-variant" />
      </Box>
      <Text className="mt-6 text-center text-base font-medium text-on-surface">
        Something went wrong
      </Text>
      <Text className="mt-3 max-w-64 text-center text-sm leading-5 text-on-surface-variant">
        We&apos;re having trouble loading this right now.
      </Text>
      <Button
        accessibilityLabel={retryLabel}
        variant="outline"
        size="sm"
        onPress={onRetry}
        className="mt-6 rounded-full border-outline-variant bg-surface-container-lowest px-6"
      >
        <ButtonText className="text-primary">Retry</ButtonText>
      </Button>
    </View>
  );
}
