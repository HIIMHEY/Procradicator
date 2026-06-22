import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';

export function TaskListSkeleton() {
  return (
    <VStack space="md" className="max-w-lg w-full">
      {[1, 2, 3].map((idx) => (
        <HStack
          key={idx}
          className="bg-white border-2 border-slate-200 rounded-2xl overflow-hidden min-h-[72px] items-stretch"
        >
          <Box className="flex-1 p-4 justify-center">
            <SkeletonText _lines={2} className="h-3 w-4/5 bg-slate-200 rounded" />
          </Box>

          <Box className="border-l-2 border-slate-200 px-6 justify-center items-center bg-slate-50/50">
            <Skeleton variant="sharp" className="h-5 w-5 bg-slate-200 rounded" />
          </Box>
        </HStack>
      ))}
    </VStack>
  );
}
