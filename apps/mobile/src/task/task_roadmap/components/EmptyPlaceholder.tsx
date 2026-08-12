import { Box } from '@/components/ui/box';
import { Center } from '@/components/ui/center';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { HelpCircleIcon, Icon } from '@/components/ui/icon';
export function EmptyTaskPlaceholder() {
  return (
    <Center className="flex-1 py-16 px-6 mx-4 my-8 bg-surface-container-low/60 rounded-3xl border border-dashed border-outline-variant">
      <Box className="p-4 bg-surface-container-low/80 rounded-full mb-4 justify-center items-center">
        <Icon as={HelpCircleIcon} className="text-outline w-8 h-8" />
      </Box>

      <Heading size="md" className="text-on-surface font-bold mb-1 text-center">
        How did we get here?
      </Heading>

      <Text size="sm" className="text-outline text-center max-w-[260px] leading-relaxed">
        Something must have gone horribly wrong for you to end up here.
      </Text>
    </Center>
  );
}
