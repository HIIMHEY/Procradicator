import { Box } from '@/components/ui/box';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { type Href, useRouter } from 'expo-router';
import { Bot, NotebookPen } from 'lucide-react-native';

type ActiveMode = 'manual' | 'ai';

interface TaskModeSwitcherProps {
  taskId?: string;
  active: ActiveMode;
}

export function TaskModeSwitcher({ taskId, active }: TaskModeSwitcherProps) {
  const router = useRouter();
  const manualHref: Href = taskId ? `/tasks/${taskId}/edit` : '/tasks/create';
  const aiHref: Href = taskId ? `/tasks/${taskId}/edit/chat` : '/tasks/create/chat';

  const switchTab = (href: Href) => {
    if (active === 'manual' && href === manualHref) return;
    if (active === 'ai' && href === aiHref) return;
    router.replace(href);
  };

  const iconClass = (isActive: boolean) =>
    isActive ? 'h-[16px] w-[16px] text-[#1E3A8A]' : 'h-[16px] w-[16px] text-on-surface-variant';

  return (
    <Box className="h-11 w-48 flex-row items-center rounded-full bg-surface-container-high p-1">
      <Button
        accessibilityLabel="Manual task mode"
        accessibilityRole="tab"
        accessibilityState={{ selected: active === 'manual' }}
        onPress={() => switchTab(manualHref)}
        variant="link"
        action="default"
        className={`h-9 min-w-0 flex-1 items-center justify-center gap-0 rounded-md p-0 ${
          active === 'manual' ? 'bg-surface-container-lowest' : 'bg-transparent'
        }`}
      >
        <Icon as={NotebookPen} size="md" className={iconClass(active === 'manual')} />
      </Button>
      <Button
        accessibilityLabel="AI chat mode"
        accessibilityRole="tab"
        accessibilityState={{ selected: active === 'ai' }}
        onPress={() => switchTab(aiHref)}
        variant="link"
        action="default"
        className={`h-9 min-w-0 flex-1 items-center justify-center gap-0 rounded-md p-0 ${
          active === 'ai' ? 'bg-surface-container-lowest' : 'bg-transparent'
        }`}
      >
        <Icon as={Bot} size="md" className={iconClass(active === 'ai')} />
      </Button>
    </Box>
  );
}
