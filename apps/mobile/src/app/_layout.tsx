import { useCurrentUser } from '@/auth/hooks/useCurrentUser';
import { Box } from '@/components/ui/box';
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, UIManager } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import OfflineIndicator from '@/offline/components/OfflineIndicator';
import ConflictModal from '@/offline/components/ConflictModal';
import OfflineSyncProvider from '@/offline/components/OfflineSyncProvider';
import '../global.css';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const CACHE_MAX_AGE = 1000 * 60 * 60 * 24;

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            gcTime: CACHE_MAX_AGE,
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
        <GestureHandlerRootView className="flex-1">
          <SyncProvider />
          <ProtectedStack />
          <OfflineIndicator />
        </GestureHandlerRootView>
      </QueryClientProvider>
    </GluestackUIProvider>
  );
}

function SyncProvider() {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    const handleOnline = () => {
      queryClient.refetchQueries({ queryKey: ['auth', 'me'] });
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [queryClient]);
  return (
    <>
      <OfflineSyncProvider />
      <ConflictModal />
    </>
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
      <Stack.Screen name="index" />
      <Stack.Protected guard={!isLoggedIn}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="auth/sso/callback" />
      </Stack.Protected>
      <Stack.Protected guard={isLoggedIn}>
        <Stack.Screen name="tasks/index" />
        <Stack.Screen name="analytics/index" />
        <Stack.Screen name="friends/index" />
        <Stack.Screen name="tasks/create" />
        <Stack.Screen name="tasks/create/chat" />
        <Stack.Screen name="tasks/[id]" />
        <Stack.Screen name="tasks/[id]/edit" />
        <Stack.Screen name="tasks/[id]/edit/chat" />
        <Stack.Screen name="focus/[id]/index" />
      </Stack.Protected>
    </Stack>
  );
}
