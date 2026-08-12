import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';

export function TaskLoadingSkeleton() {
  return (
    <Box className="w-full h-full flex flex-col bg-surface-container-low p-6 relative overflow-hidden">
      <HStack className="justify-between items-center w-full mb-8 pt-4">
        <Skeleton className="h-8 w-8 rounded-full" variant="rounded" />
      </HStack>

      <Box className="pb-6">
        <SkeletonText className="h-6 w-64 mb-2" speed={2} />
        <SkeletonText className="h-4 w-80 mb-4" speed={2} />
        <Skeleton className="h-6 w-24 rounded-full" variant="rounded" />
      </Box>

      <Box className="flex-1 w-full justify-start overflow-hidden">
        {[1, 2, 3].map((item, index) => (
          <Box key={item} className="flex-row items-stretch">
            <Box className="w-12 items-center">
              <Skeleton className="w-10 h-10 rounded-full" variant="rounded" />
              {index < 2 && <Box className="w-[2px] flex-1 bg-outline-variant mt-1" />}
            </Box>
            <Box className="flex-1 pl-3 pb-8">
              <SkeletonText className="h-4 w-40 mb-1" speed={2} />
              <SkeletonText className="h-3 w-56" speed={2} />
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
