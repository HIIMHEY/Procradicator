import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';
import { View } from 'react-native';

function MetricSkeleton() {
  return (
    <Box className="min-h-[88px] flex-1 justify-center rounded-xl border border-slate-200 bg-white px-3 py-3">
      <HStack className="items-center gap-2">
        <Skeleton variant="rounded" className="h-7 w-7 rounded-lg bg-blue-100" />
        <SkeletonText _lines={1} className="h-3 w-20 rounded bg-slate-200" />
      </HStack>
      <SkeletonText _lines={1} className="mt-2 h-5 w-16 rounded bg-slate-200" />
    </Box>
  );
}

export function AnalyticsLoadingSkeleton() {
  return (
    <View accessibilityLabel="Analytics loading" className="w-full gap-2">
      <MetricSkeleton />
      {[1, 2, 3].map((row) => (
        <HStack key={row} className="w-full gap-2">
          <MetricSkeleton />
          <MetricSkeleton />
        </HStack>
      ))}
    </View>
  );
}
