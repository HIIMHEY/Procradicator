import { Box } from '@/components/ui/box';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { CheckCircleIcon, Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

type Props = {
  completedIds: number;
  totalSubtasks: number;
  onFinish: () => void;
  isPending: boolean;
};

export function CongratsScreen({ completedIds, totalSubtasks, onFinish, isPending }: Props) {
  return (
    <Box className="flex-1 items-center justify-center px-6">
      <Icon as={CheckCircleIcon} className="text-green-500 mb-4" size="xl" />
      <Text className="text-xl text-gray-800 mb-2">
        Well done. You've made progress.
      </Text>
      <Text className="text-lg text-gray-500 mb-8">
        {completedIds}/{totalSubtasks}
      </Text>
      <Button
        className="bg-black rounded-full px-8 py-3"
        onPress={onFinish}
        disabled={isPending}
      >
        {isPending && <ButtonSpinner testID="finish-spinner" className="mr-2" />}
        <ButtonText className="text-white font-semibold">Finish</ButtonText>
      </Button>
    </Box>
  );
}
