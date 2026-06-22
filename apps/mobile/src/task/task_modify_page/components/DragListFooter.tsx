import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { AddIcon, CheckIcon, Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/spinner';

interface DragListFooterProps {
  handleSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
  handleAddSubtask: () => void;
  isDisabled: boolean;
  isPending: boolean;
}

export function DragListFooter({
  handleSubmit,
  handleAddSubtask,
  isDisabled,
  isPending,
}: DragListFooterProps) {
  return (
    <Box className="bottom-0 left-0 right-0 p-4 bg-white/95 border-t border-slate-100 flex-row justify-between items-center shadow-lg z-50">
      <Button onPress={handleAddSubtask} className="bg-indigo-600 rounded-full py-2.5 px-5">
        <ButtonText className="text-white text-sm font-semibold">Create Subtask</ButtonText>
        <Icon as={AddIcon} color="white" />
      </Button>
      <Button
        disabled={isDisabled}
        onPress={handleSubmit}
        className="bg-emerald-700 rounded-full py-2.5 px-6"
      >
        <ButtonText className="text-white text-sm font-semibold">Done</ButtonText>
        {isPending ? <Spinner size="small" color="white" /> : <Icon as={CheckIcon} color="white" />}
      </Button>
    </Box>
  );
}
