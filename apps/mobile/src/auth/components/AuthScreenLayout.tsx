import { Box } from '@/components/ui/box';
import { Button, ButtonIcon } from '@/components/ui/button';
import { ArrowLeftIcon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
//Anything react can render type
import { ScrollView } from 'react-native';

type AuthScreenLayoutProps = {
  title: string;
  subtitle?: string;
  showBackButton?: boolean;
  children: ReactNode;
  //Register/login button for landing page
  //username/password field, submit button for login page
  //email/username/password field for register page
};

export function AuthScreenLayout({
  title,
  subtitle,
  showBackButton = false,
  children,
}: AuthScreenLayoutProps) {
  const router = useRouter();
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic" //adjust spacing around system areas
      keyboardShouldPersistTaps="handled" //buttons behave nicely when keyboard is open
      className="flex-1 bg-white"
      contentContainerClassName="flex-grow"
    >
      <Box className="flex-1 bg-white px-8 py-12">
        {showBackButton ? (
          <Button
            accessibilityLabel="Go back"
            action="default"
            variant="link"
            size="lg"
            onPress={() => router.back()}
            className="h-12 w-12 self-start p-0"
          >
            <ButtonIcon as={ArrowLeftIcon} className="h-8 w-8 text-black" />
          </Button>
        ) : null}

        <VStack className="flex-1 justify-center gap-8">
          <VStack className="items-center gap-3">
            <Text className="text-center text-3xl font-bold text-slate-950">{title}</Text>
            {subtitle ? (
              <Text className="max-w-[280px] text-center text-base text-slate-600">{subtitle}</Text>
            ) : null}
          </VStack>

          <VStack className="w-full max-w-[320px] self-center gap-4">{children}</VStack>
        </VStack>
      </Box>
    </ScrollView>
  );
}
