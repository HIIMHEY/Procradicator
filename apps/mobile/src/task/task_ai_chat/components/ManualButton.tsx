import { Box } from '@/components/ui/box';
import { Button } from '@/components/ui/button';
import { type Href, useRouter } from 'expo-router';
import { Bot, List, Pencil } from 'lucide-react-native';

interface ManualButtonProps {
  taskId?: string;
}

export function ManualButton({ taskId }: ManualButtonProps) {
  const router = useRouter();
  const navStr: Href = taskId ? `/tasks/${taskId}/edit` : '/tasks/create';
  return (
    <Box className="h-12 w-44 flex-row rounded-full bg-surface-container-highest p-1">
      <Button
        accessibilityLabel="Manual task mode"
        accessibilityRole="tab"
        accessibilityState={{ selected: false }}
        onPress={() => router.navigate(navStr)}
        variant="link"
        action="default"
        className="h-10 flex-1 items-center justify-center gap-0 rounded-full p-0"
      >
        <List size={28} strokeWidth={2.5} color="#717783" />
        <Pencil size={15} strokeWidth={2.5} color="#717783" className="-ml-1 mt-3" />
      </Button>

      <Button
        accessibilityLabel="AI chat mode"
        accessibilityRole="tab"
        accessibilityState={{ selected: true }}
        onPress={() => undefined}
        action="default"
        variant="solid"
        className="h-10 flex-1 items-center justify-center rounded-full bg-surface-container-lowest"
      >
        <Bot size={30} strokeWidth={2.5} color="#0060AC" />
      </Button>
    </Box>
  );
}
