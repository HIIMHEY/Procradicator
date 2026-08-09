import { Box } from '@/components/ui/box';
import { Button } from '@/components/ui/button';
import { type Href, useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { TaskModeSwitcher } from './TaskModeSwitcher';

interface TaskHeaderProps {
  taskId?: string;
  active: 'manual' | 'ai';
  backHref: Href;
}

export function TaskHeader({ taskId, active, backHref }: TaskHeaderProps) {
  const router = useRouter();
  return (
    <Box className="flex-row items-center justify-between p-4">
      <Button
        accessibilityLabel="Close task editor"
        onPress={() => router.replace(backHref)}
        variant="link"
        action="default"
        className="h-11 w-11 items-center justify-center rounded-full p-0"
      >
        <X size={26} strokeWidth={2.5} color="#1E3A8A" />
      </Button>
      <TaskModeSwitcher taskId={taskId} active={active} />
    </Box>
  );
}
