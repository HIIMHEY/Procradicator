/// <reference types="jest" />

beforeEach(() => {
  Object.defineProperty(globalThis.navigator, 'onLine', {
    configurable: true,
    value: true,
  });
});

jest.mock(
  '@tanstack/devtools-event-client',
  () => {
    class EventClient {
      getPluginId() {
        return 'form-devtools';
      }

      createEventPayload(eventSuffix: string, payload: unknown) {
        return {
          type: eventSuffix,
          payload,
          pluginId: 'form-devtools',
        };
      }

      emit() {}

      on() {
        return () => {};
      }

      onAll() {
        return () => {};
      }

      onAllPluginEvents() {
        return () => {};
      }
    }

    return { EventClient };
  },
  { virtual: true },
);

jest.mock('nativewind', () => ({
  ...jest.requireActual('nativewind'),
  useColorScheme: () => ({
    colorScheme: 'light',
    setColorScheme: jest.fn(),
    toggleColorScheme: jest.fn(),
  }),
}));

jest.mock('@legendapp/motion', () => {
  const { View } = jest.requireActual('react-native');

  return {
    AnimatePresence: View,
    Motion: {
      View,
    },
  };
});

jest.mock('@tanstack/react-query-persist-client', () => {
  const { QueryClientProvider } = jest.requireActual('@tanstack/react-query');
  return {
    PersistQueryClientProvider: ({ client, children }: { client: unknown; children: React.ReactNode }) =>
      QueryClientProvider({ client, children }),
  };
});

jest.mock('@tanstack/query-async-storage-persister', () => ({
  createAsyncStoragePersister: () => ({
    persistClient: jest.fn(),
    restoreClient: jest.fn(),
    removeClient: jest.fn(),
    isRestoringClient: jest.fn(() => false),
  }),
}));

jest.mock('@/offline/useOnlineStatus', () => ({
  useOnlineStatus: () => true,
}));

jest.mock('@/offline/storage', () => ({
  readRecovery: jest.fn().mockResolvedValue(null),
  writeRecovery: jest.fn().mockResolvedValue(undefined),
  clearRecovery: jest.fn().mockResolvedValue(undefined),
  readConflicts: jest.fn().mockResolvedValue([]),
  writeConflict: jest.fn().mockResolvedValue(undefined),
  deleteConflict: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/offline/components/OfflineIndicator', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: View };
});

jest.mock('@/offline/components/ConflictModal', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: View };
});

jest.mock('@/offline/TaskSyncProvider', () => {
  const { View } = jest.requireActual('react-native');
  const original = jest.requireActual('@/offline/TaskSyncProvider');
  return { __esModule: true, default: View, requestSync: original.requestSync };
});
