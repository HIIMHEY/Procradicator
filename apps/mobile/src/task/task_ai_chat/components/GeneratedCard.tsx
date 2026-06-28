import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useRouter } from 'expo-router';
import { Eye } from 'lucide-react-native';

interface ToolCallCardProps {
  taskId?: string;
  message: string;
}

export function GeneratedCard({ taskId, message }: ToolCallCardProps) {
  const router = useRouter();
  const viewTask = () => {
    if (!taskId) return;
    router.navigate(`/tasks/${taskId}`);
  };
  return (
    <Box className="mb-6 w-full flex-row justify-start">
      <Box className="w-[150px] rounded-[24px] border bg-white px-4 pb-4 pt-6 border-[#E5E5E5]">
        <Text className="mb-10 text-sm leading-5 text-zinc-700">{message}</Text>

        {taskId ? (
          <Button
            onPress={viewTask}
            variant="outline"
            className="h-10 flex-row items-center justify-center gap-1 rounded-lg border px-3 border-[#6D2DE2]"
          >
            <Icon as={Eye} size="sm" color="#6D2DE2" />
            <ButtonText className="text-sm font-medium color-[#6D2DE2]">View Task</ButtonText>
          </Button>
        ) : null}
      </Box>
    </Box>
  );
}
