import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';
import { Icon, ArrowDownIcon } from '@/components/ui/icon';

export function TaskLoadingSkeleton() {
  return (
    <Box className="w-full h-screen max-h-screen flex flex-col bg-white p-6 relative overflow-hidden">
      <HStack className="justify-between items-center w-full mb-8 pt-4">
        <Skeleton className="h-8 w-8 rounded-full" variant="rounded" />
      </HStack>

      <VStack space="lg" className="flex-1 w-full items-center justify-start overflow-y-auto pt-4">
        {[1, 2, 3].map((item, index) => (
          <VStack key={item} space="xs" className="w-full max-w-md items-center">
            <SkeletonText className="h-4 w-48 mb-1" speed={2} />

            <Skeleton className="w-32 h-10 rounded-2xl" variant="rounded" />

            {index < 2 && (
              <Box className="my-1 flex justify-center items-center">
                <Icon as={ArrowDownIcon} size="xl" className="text-slate-300" />
              </Box>
            )}
          </VStack>
        ))}
      </VStack>
    </Box>
  );
}
