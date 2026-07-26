import { jest } from '@jest/globals';
import type { ComponentType, PropsWithChildren, ReactNode } from 'react';

type RootHtml = ComponentType<PropsWithChildren>;

const { renderToStaticMarkup } = jest.requireActual<{
  renderToStaticMarkup: (node: ReactNode) => string;
}>('react-dom/server');

const loadRootHtml = (): RootHtml | null => {
  const modulePath = '../../src/app/' + '+html';

  try {
    return jest.requireActual<{ default: RootHtml }>(modulePath).default;
  } catch (error) {
    const moduleError = error as NodeJS.ErrnoException;
    if (moduleError.code === 'MODULE_NOT_FOUND' && moduleError.message.includes('+html')) {
      return null;
    }
    throw error;
  }
};

const renderRootHtml = (): string => {
  const RootHtml = loadRootHtml();
  if (!RootHtml) {
    expect(RootHtml).not.toBeNull();
    throw new Error('Root HTML is missing');
  }
  return renderToStaticMarkup(<RootHtml>App</RootHtml>);
};

describe('PWA shell', () => {
  test('links the install manifest from rendered HTML', () => {
    const markup = renderRootHtml();
    const manifest = markup.match(/<link\b[^>]*rel="manifest"[^>]*>/)?.[0];

    expect(manifest).toContain('href="/manifest.json"');
  });

  test('registers the service worker after the page loads', () => {
    const markup = renderRootHtml();
    const script = markup.match(/<script\b[^>]*data-register-sw[^>]*>([\s\S]*?)<\/script>/)?.[1];
    const register = jest.fn<() => Promise<void>>().mockResolvedValue();
    let handleLoad: (() => void) | undefined;
    const windowStub = {
      addEventListener: (_event: string, listener: () => void) => {
        handleLoad = listener;
      },
    };
    const navigatorStub = { serviceWorker: { register } };

    expect(script).toBeTruthy();
    new Function('window', 'navigator', script ?? '')(windowStub, navigatorStub);
    expect(register).not.toHaveBeenCalled();

    handleLoad?.();
    expect(register).toHaveBeenCalledWith('/sw.js');
  });
});
