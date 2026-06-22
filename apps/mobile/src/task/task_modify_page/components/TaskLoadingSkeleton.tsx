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
        <Skeleton className="h-8 w-24 rounded-full" variant="rounded" />
      </HStack>

      <VStack space="md" className="mb-3">
        <SkeletonText className="h-12 w-full" speed={2} />
        <SkeletonText className="h-12 w-full" speed={2} />
      </VStack>

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

      <HStack className="w-full justify-between items-center pt-4 border-t border-slate-100 bg-white absolute bottom-0 left-0 right-0 p-6">
        <Skeleton className="h-12 w-32 rounded-full" />
        <Skeleton className="h-12 w-32 rounded-full" />
      </HStack>
    </Box>
  );
}
