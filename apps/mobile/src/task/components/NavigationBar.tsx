import { Box } from '@/components/ui/box';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Href, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';

interface NavigationBarProps {
  backurl: Href;
}

export function NavigationBar({ backurl }: NavigationBarProps) {
  const router = useRouter();
  return (
    <Box className="bottom-0 left-0 right-0 p-4 bg-white/95 border-t border-slate-100 flex-row justify-between items-center shadow-lg z-50">
      <Button
        onPress={() => router.replace(backurl)}
        variant="link"
        className="rounded-full py-2.5 px-5"
      >
        <Icon as={ArrowLeft} size="xl" color="black" />
      </Button>
    </Box>
  );
}
