import { Button, ButtonText } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Href, useRouter } from 'expo-router';
import { Pencil } from 'lucide-react-native';

interface ManualButtonProps {
  taskId?: string;
}

export function ManualButton({ taskId }: ManualButtonProps) {
  const router = useRouter();
  const navStr: Href = taskId ? `/tasks/${taskId}/edit` : '/tasks/create';
  return (
    <Button
      onPress={() => router.navigate(navStr)}
      className="flex-row items-center gap-1.5 rounded-full px-4 py-3 bg-[#6D2DE2]"
    >
      <Icon as={Pencil} size="xs" color="white" />
      <ButtonText className="text-xs font-medium text-white">Manual Mode</ButtonText>
    </Button>
  );
}
