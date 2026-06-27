import { Button, ButtonText } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { useRouter } from 'expo-router';
import { WandSparkles } from 'lucide-react-native';

interface AIButtonProps {
  taskId: string;
}

export function AIButton({ taskId }: AIButtonProps) {
  const router = useRouter();
  return (
    <Button
      onPress={() => {
        if (!taskId) router.navigate(`/tasks/chat`);
        else router.navigate(`/tasks/${taskId}/chat`);
      }}
      className="bg-indigo-600 rounded-full py-2.5 px-5"
    >
      <ButtonText numberOfLines={1} className="text-white text-sm font-semibold">
        AI Mode
      </ButtonText>
      <Icon as={WandSparkles} color="white" />
    </Button>
  );
}
