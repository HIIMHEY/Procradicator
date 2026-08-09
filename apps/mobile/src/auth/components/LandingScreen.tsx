import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { type Href, useRouter } from 'expo-router';
import { ScrollView } from 'react-native';

export function LandingScreen() {
  const router = useRouter();
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      className="flex-1 bg-background"
      contentContainerClassName="flex-grow"
    >
      <Box className="w-full max-w-[390px] flex-1 self-center px-margin-mobile py-6">
        <HStack className="items-center justify-between">
          <Text className="text-xl font-bold text-primary">Procradicator</Text>
          <Button
            accessibilityLabel="Sign In"
            size="sm"
            onPress={() => router.navigate('/login' as Href)}
            className="rounded bg-primary px-5"
          >
            <ButtonText className="text-sm font-medium text-on-primary">Sign In</ButtonText>
          </Button>
        </HStack>

        <VStack className="flex-1 items-center justify-center gap-5 pb-12">
          <Text className="text-center text-3xl font-semibold text-on-background">
            Focus on now.
          </Text>
          <Button
            accessibilityLabel="Get Started"
            size="xl"
            onPress={() => router.navigate('/register' as Href)}
            className="w-36 rounded bg-primary shadow-sm"
          >
            <ButtonText className="text-sm font-medium text-on-primary">Get Started</ButtonText>
          </Button>
        </VStack>
      </Box>
    </ScrollView>
  );
}
