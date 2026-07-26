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
          className="min-h-20 flex-row items-center rounded-xl bg-[#EAF0FF] px-4 py-3"
        >
          <SkeletonText _lines={1} className="h-4 w-32 rounded bg-blue-100" />
          <Skeleton variant="rounded" className="ml-auto h-10 w-20 rounded-xl bg-blue-100" />
        </Box>
      ))}
    </View>
  );
}

export function FriendEmpty({ description, label, title }: FriendEmptyProps) {
  return (
    <View accessibilityLabel={label} className="flex-1 items-center justify-center px-8 pb-24">
      <Box className="h-20 w-20 items-center justify-center rounded-full bg-blue-50">
        <Icon as={UserRound} size="xl" className="text-blue-500" />
      </Box>
      <Text className="mt-6 text-center text-xl font-medium text-slate-900">{title}</Text>
      <Text className="mt-3 max-w-64 text-center text-sm leading-5 text-slate-500">
        {description}
      </Text>
    </View>
  );
}

export function FriendError({ label, onRetry, retryLabel }: FriendErrorProps) {
  return (
    <View accessibilityLabel={label} className="flex-1 items-center justify-center px-8 pb-24">
      <Box className="h-20 w-20 items-center justify-center rounded-full bg-blue-50">
        <Icon as={CircleAlert} size="xl" className="text-slate-500" />
      </Box>
      <Text className="mt-6 text-center text-base font-medium text-slate-900">
        Something went wrong
      </Text>
      <Text className="mt-3 max-w-64 text-center text-sm leading-5 text-slate-500">
        We&apos;re having trouble loading this right now.
      </Text>
      <Button
        accessibilityLabel={retryLabel}
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
