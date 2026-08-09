import { Box } from '@/components/ui/box';
import { Button, ButtonIcon } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { ArrowLeftIcon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';

type AuthScreenLayoutProps = {
  title: string;
  subtitle?: string;
  showBackButton?: boolean;
  children: ReactNode;
};

export function AuthScreenLayout({
  title,
  subtitle,
  showBackButton = false,
  children,
}: AuthScreenLayoutProps) {
  const router = useRouter();
  const handleBack = (): void => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/');
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      className="flex-1 bg-background"
      contentContainerClassName="flex-grow"
    >
      <Box className="w-full max-w-[390px] flex-1 self-center bg-background px-margin-mobile py-6 md:max-w-none">
        {showBackButton ? (
          <HStack className="items-center gap-2">
            <Button
              accessibilityLabel="Go back"
              action="default"
              variant="link"
              size="lg"
              onPress={handleBack}
              className="h-11 w-11 p-0"
            >
              <ButtonIcon as={ArrowLeftIcon} className="h-7 w-7 text-on-background" />
            </Button>
            <Text className="text-xl font-bold text-primary">Procradicator</Text>
          </HStack>
        ) : null}

        <VStack className="flex-1 gap-7 pb-10 pt-20">
          <VStack className="items-center gap-3">
            <Text className="text-center text-3xl font-bold text-on-background">{title}</Text>
            {subtitle ? (
              <Text className="max-w-[280px] text-center text-base text-outline">{subtitle}</Text>
            ) : null}
          </VStack>

          <VStack className="w-full max-w-[320px] self-center gap-4">{children}</VStack>
        </VStack>
      </Box>
    </ScrollView>
  );
}
