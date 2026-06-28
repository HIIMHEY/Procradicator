import { Box } from '@/components/ui/box';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Href, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { ReactNode } from 'react';

interface NavigationBarProps {
  backurl: Href;
  renderRightAction?: () => ReactNode;
}

export function NavigationBar({ backurl, renderRightAction }: NavigationBarProps) {
  const router = useRouter();
  return (
    <Box className="top-0 left-0 right-0 p-4 bg-white/95 border-t border-slate-100 flex-row justify-between items-center shadow-lg z-50">
      <Button
        onPress={() => router.replace(backurl)}
        variant="link"
        className="rounded-full py-2.5 px-5"
      >
        <Icon as={ArrowLeft} size="xl" color="black" />
      </Button>
      <Box className="w-12 items-end">{renderRightAction ? renderRightAction() : null}</Box>
    </Box>
  );
}
