import { useCurrentUser } from '@/auth/hooks/useCurrentUser';
import { Box } from '@/components/ui/box';
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { registerMutationDefaults } from '@/offline/mutationDefaults';
import { QueryClient, useQueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useIsRestoring } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, UIManager } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import OfflineIndicator from '@/offline/components/OfflineIndicator';
import ConflictModal from '@/offline/components/ConflictModal';
import '../global.css';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const CACHE_MAX_AGE = 1000 * 60 * 60 * 24;

function getWebIDBStorage(): { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void>; removeItem: (key: string) => Promise<void> } | undefined {
  if (typeof window === 'undefined' || !window.indexedDB) return undefined;
  const DB_NAME = 'procradicator-query-cache';
  const DB_VERSION = 1;
  const STORE = 'cache';
  function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  let dbPromise: Promise<IDBDatabase> | null = null;
  function getDB() {
    if (!dbPromise) dbPromise = openDB();
    return dbPromise;
  }
  return {
    async getItem(key: string) {
      const db = await getDB();
      return new Promise<string | null>((resolve) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(key);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => resolve(null);
      });
    },
    async setItem(key: string, value: string) {
      const db = await getDB();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
    async removeItem(key: string) {
      const db = await getDB();
      return new Promise<void>((resolve) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(key);
        tx.oncomplete = () => resolve();
      });
    },
  };
}

export default function RootLayout() {
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          retry: 1,
          gcTime: CACHE_MAX_AGE,
        },
        mutations: {
          retry: false,
        },
      },
    });
    registerMutationDefaults(client);
    return client;
  });

  const persisterRef = useRef<ReturnType<typeof createAsyncStoragePersister> | null>(null);
  if (!persisterRef.current) {
    const storage = getWebIDBStorage();
    persisterRef.current = createAsyncStoragePersister({
      storage: storage ?? undefined,
      key: 'procradicator-query-cache',
    });
  }

  const persistOptions = useMemo(
    () => ({ persister: persisterRef.current!, maxAge: CACHE_MAX_AGE }),
    [],
  );

  const handlePersistSuccess = useCallback(() => {
    queryClient.resumePausedMutations();
  }, [queryClient]);

  return (
    <GluestackUIProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={persistOptions}
        onSuccess={handlePersistSuccess}
      >
        <GestureHandlerRootView className="flex-1">
          <SyncProvider />
          <PersistGate>
            <ProtectedStack />
          </PersistGate>
        </GestureHandlerRootView>
      </PersistQueryClientProvider>
    </GluestackUIProvider>
  );
}

function PersistGate({ children }: { children: ReactNode }) {
  const isRestoring = useIsRestoring();
  if (isRestoring) {
    return (
      <Box className="flex-1 items-center justify-center gap-3 bg-white px-8">
        <Spinner aria-label="Restoring session" size="large" />
        <Text className="text-center text-base text-slate-600">Restoring session...</Text>
      </Box>
    );
  }
  return <>{children}</>;
}

function SyncProvider() {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (typeof window?.addEventListener !== 'function') return;
    const handleOnline = () => {
      queryClient.refetchQueries({ queryKey: ['auth', 'me'] });
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [queryClient]);
  return (
    <>
      <OfflineIndicator />
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
