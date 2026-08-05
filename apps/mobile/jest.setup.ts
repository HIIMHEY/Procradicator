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

jest.mock('@/offline/components/OfflineIndicator', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: View };
});

jest.mock('@/offline/components/ConflictModal', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: View };
});

jest.mock('@/offline/components/OfflineSyncProvider', () => {
  const { View } = jest.requireActual('react-native');
  const original = jest.requireActual('@/offline/components/OfflineSyncProvider');
  return { __esModule: true, default: View, requestSync: original.requestSync };
});
