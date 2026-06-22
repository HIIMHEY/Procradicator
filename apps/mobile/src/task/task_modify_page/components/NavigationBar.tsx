import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { useRouter } from 'expo-router';
import { ArrowLeft, WandSparkles } from 'lucide-react-native';

export function NavigationBar() {
  const router = useRouter();
  return (
    <Box className="bottom-0 left-0 right-0 p-4 bg-white/95 border-t border-slate-100 flex-row justify-between items-center shadow-lg z-50">
      <Button
        onPress={() => router.replace('/tasks')}
        variant="link"
        className="rounded-full py-2.5 px-5"
      >
        <Icon as={ArrowLeft} size="xl" color="black" />
      </Button>
      <Button
        onPress={() => {
          //TODO: ADD AI CHAT PAGE
          router.replace('/tasks');
        }}
        className="bg-indigo-600 rounded-full py-2.5 px-5"
      >
        <ButtonText className="text-white text-sm font-semibold">AI Mode</ButtonText>
        <Icon as={WandSparkles} color="white" />
      </Button>
    </Box>
  );
}
