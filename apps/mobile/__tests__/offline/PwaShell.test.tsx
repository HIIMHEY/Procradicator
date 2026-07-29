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

const renderRootHtml = (nodeEnv = process.env.NODE_ENV): string => {
  const RootHtml = loadRootHtml();
  if (!RootHtml) {
    expect(RootHtml).not.toBeNull();
    throw new Error('Root HTML is missing');
  }
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = nodeEnv;
  try {
    return renderToStaticMarkup(<RootHtml>App</RootHtml>);
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
  }
};

describe('PWA shell', () => {
  test('links the install manifest from rendered HTML', () => {
    const markup = renderRootHtml();
    const manifest = markup.match(/<link\b[^>]*rel="manifest"[^>]*>/)?.[0];

    expect(manifest).toContain('href="/manifest.json"');
  });

  test('registers the service worker in production after the page loads', () => {
    const markup = renderRootHtml('production');
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

  test('does not register a service worker during development', () => {
    const markup = renderRootHtml('development');
    const script = markup.match(/<script\b[^>]*data-register-sw[^>]*>([\s\S]*?)<\/script>/)?.[1];
    const register = jest.fn<() => Promise<void>>().mockResolvedValue();
    let handleLoad: (() => void) | undefined;
    const windowStub = {
      addEventListener: (_event: string, listener: () => void) => {
        handleLoad = listener;
      },
    };
    const navigatorStub = { serviceWorker: { register } };

    new Function('window', 'navigator', script ?? '')(windowStub, navigatorStub);
    handleLoad?.();

    expect(register).not.toHaveBeenCalled();
  });
});
