import { Box } from '@/components/ui/box';
import { Pressable } from '@/components/ui/pressable';
import { EditIcon, Icon, MenuIcon, TrashIcon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Button, ButtonText } from '@/components/ui/button';
import { ModifySubtaskData } from '@/task/schema';

interface SubtaskActionsProps {
  value: ModifySubtaskData;
  index: number;
  onDragTrigger: () => void;
  onDelete: () => void;
  isLast: boolean;
  onEdit: () => void;
}

export function SubtaskActions({
  value,
  index,
  onDragTrigger,
  onDelete,
  onEdit,
}: SubtaskActionsProps) {
  return (
    <Box className="w-full items-center">
      <Text className="text-sm text-slate-700 font-medium mb-1.5">
        {value?.title || `To do number ${index + 1} ...`}
        {value?.estimate ? `: ${value.estimate} min` : ''}
      </Text>

      <Pressable
        onLongPress={onDragTrigger}
        delayLongPress={100}
        className="flex-row items-center justify-center bg-[#ffdd43] border border-amber-400 rounded-xl px-4 py-1.5"
      >
        <Box className="flex-row items-center mr-4">
          <Button variant="link" className="p-0 h-auto" onPress={onEdit}>
            <Icon as={EditIcon} color="black" />
            <ButtonText className="text-sm font-bold text-slate-800">Edit</ButtonText>
          </Button>
        </Box>

        <Box className="h-4">
          <Icon as={MenuIcon} color="black" />
        </Box>

        <Box className="flex-row items-center ml-4">
          <Button variant="link" className="p-0 h-auto mr-1.5" onPress={onDelete}>
            <ButtonText className="text-sm font-bold text-red-600">Delete</ButtonText>
            <Icon as={TrashIcon} color="red" />
          </Button>
        </Box>
      </Pressable>
    </Box>
  );
}
