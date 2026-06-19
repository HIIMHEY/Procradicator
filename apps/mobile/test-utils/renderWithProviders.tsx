/// <reference types="jest" />

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';

const testQueryClients: QueryClient[] = [];

afterEach(() => {
  for (const queryClient of testQueryClients) {
    queryClient.clear();
  }
  testQueryClients.length = 0;
});

function createTestQueryClient() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { gcTime: Infinity, retry: false },
      mutations: { gcTime: Infinity, retry: false },
    },
  });
  testQueryClients.push(queryClient);
  return queryClient;
}

export function renderWithProviders(ui: ReactElement) {
  const queryClient = createTestQueryClient();
  return render(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <GluestackUIProvider>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </GluestackUIProvider>
    ),
  });
}
