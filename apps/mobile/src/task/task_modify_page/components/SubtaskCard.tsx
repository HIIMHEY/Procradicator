import { Box } from '@/components/ui/box';
import { Pressable } from '@/components/ui/pressable';
import { EditIcon, GripVerticalIcon, Icon, TrashIcon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { ModifySubtaskData } from '@/task/schema';
import { formatEstimate } from '@/task/utils';

interface SubtaskCardProps {
  value: ModifySubtaskData;
  index: number;
  onDragTrigger: () => void;
  onDelete: () => void;
  onEdit: () => void;
}

export function SubtaskCard({ value, index, onDragTrigger, onDelete, onEdit }: SubtaskCardProps) {
  return (
    <Box className="w-full flex-row items-center rounded-2xl border border-outline-variant bg-surface-container-lowest px-3 py-3 shadow-sm">
      <Box className="flex-1 pr-2">
        <Text className="text-sm font-medium text-on-surface">
          {value.title || `To do number ${index + 1} ...`}
        </Text>
        <Text className="mt-0.5 text-xs text-on-surface-variant">
          Est: {formatEstimate(value.est_m)}
        </Text>
      </Box>
      <Box className="flex-row items-center gap-3">
        <Pressable accessibilityLabel={`Edit subtask ${index + 1}`} onPress={onEdit}>
          <Icon as={EditIcon} size="sm" className="text-on-surface-variant" />
        </Pressable>
        <Pressable accessibilityLabel={`Delete subtask ${index + 1}`} onPress={onDelete}>
          <Icon as={TrashIcon} size="sm" className="text-on-surface-variant" />
        </Pressable>
        <Pressable
          accessibilityLabel={`Reorder subtask ${index + 1}`}
          onLongPress={onDragTrigger}
          delayLongPress={100}
        >
          <Icon as={GripVerticalIcon} size="md" className="text-outline" />
        </Pressable>
      </Box>
    </Box>
  );
}
