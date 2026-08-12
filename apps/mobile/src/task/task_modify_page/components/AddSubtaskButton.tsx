import { Box } from '@/components/ui/box';
import { Pressable } from '@/components/ui/pressable';
import { AddIcon, Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

interface AddSubtaskButtonProps {
  onPress: () => void;
}

export function AddSubtaskButton({ onPress }: AddSubtaskButtonProps) {
  return (
    <Box className="px-4 my-1 flex-row">
      <Box className="w-8 items-center">
        <Box className="h-6 w-6 items-center justify-center rounded-full border-2 border-dashed border-outline-variant">
          <Icon as={AddIcon} size="xs" className="text-outline" />
        </Box>
      </Box>
      <Box className="flex-1 pb-2">
        <Pressable
          accessibilityLabel="Add Subtask"
          onPress={onPress}
          className="w-full flex-row items-center justify-center rounded-xl border border-dashed border-outline-variant bg-surface-container-low py-3"
        >
          <Icon as={AddIcon} size="sm" className="text-on-surface-variant" />
          <Text className="ml-1 text-sm font-medium text-on-surface-variant">Add Subtask</Text>
        </Pressable>
      </Box>
    </Box>
  );
}
