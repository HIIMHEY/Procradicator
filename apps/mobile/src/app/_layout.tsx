import { useCurrentUser } from '@/auth/hooks/useCurrentUser';
import { Box } from '@/components/ui/box';
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Platform, UIManager } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import '../global.css';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
          },
          mutations: {
            retry: false,
          },
        },
      }),
  );
  return (
    <GluestackUIProvider>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView>
          <ProtectedStack />
        </GestureHandlerRootView>
      </QueryClientProvider>
    </GluestackUIProvider>
  );
}

function ProtectedStack() {
  const { data: currentUser, isPending } = useCurrentUser();
  const isLoggedIn = !!currentUser;
  if (isPending) {
    return (
      <Box className="flex-1 items-center justify-center gap-3 bg-white px-8">
        <Spinner aria-label="Checking your session" size="large" />
        <Text className="text-center text-base text-slate-600">Checking your session...</Text>
      </Box>
    );
  }
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!isLoggedIn}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="auth/sso/callback" />
      </Stack.Protected>
      <Stack.Protected guard={isLoggedIn}>
        <Stack.Screen name="tasks/index" />
        <Stack.Screen name="tasks/create" />
        <Stack.Screen name="tasks/[id]/edit" />
        <Stack.Screen name="focus/[id]/index" />
      </Stack.Protected>
    </Stack>
  );
}
