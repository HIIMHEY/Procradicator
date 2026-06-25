import { Box } from '@/components/ui/box';
import { Center } from '@/components/ui/center';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { ListPlus } from 'lucide-react-native';

export function EmptyTaskPlaceholder() {
  return (
    <Center className="flex-1 py-16 px-6 mx-4 my-8 bg-slate-50/60 rounded-3xl border border-dashed border-slate-200">
      <Box className="p-4 bg-slate-100/80 rounded-full mb-4 justify-center items-center">
        <Icon as={ListPlus} className="text-slate-400 w-8 h-8" />
      </Box>
    
      <Heading size="md" className="text-slate-700 font-bold mb-1 text-center">
        No Subtasks Yet
      </Heading>

      <Text size="sm" className="text-slate-400 text-center max-w-[260px] leading-relaxed">
        Break down this task by clicking the button below to add steps.
      </Text>
    </Center>
  );
}
