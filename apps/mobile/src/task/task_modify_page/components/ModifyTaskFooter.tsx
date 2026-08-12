import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { TaskModifyMode } from '@/task/schema';

interface ModifyTaskFooterProps {
  mode: TaskModifyMode;
  handleSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
  isDisabled: boolean;
  isPending: boolean;
}

export function ModifyTaskFooter({
  mode,
  handleSubmit,
  isDisabled,
  isPending,
}: ModifyTaskFooterProps) {
  const label = mode === 'Edit' ? 'Save Changes' : 'Create Task';
  return (
    <Box className="px-4 pb-4 pt-2">
      <Button
        disabled={isDisabled || isPending}
        onPress={handleSubmit}
        className="h-12 w-full rounded-xl bg-[#3B59B6] disabled:bg-on-surface-variant"
      >
        <ButtonText className="text-white font-semibold">{label}</ButtonText>
        {isPending ? <Spinner size="small" color="white" /> : null}
      </Button>
    </Box>
  );
}
