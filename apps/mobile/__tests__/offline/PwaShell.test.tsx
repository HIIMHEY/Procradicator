import { jest } from '@jest/globals';
import type { PropsWithChildren } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

type RootHtml = (props: PropsWithChildren) => React.ReactNode;

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

const renderRootHtml = (): Document => {
  const RootHtml = loadRootHtml();
  expect(RootHtml).not.toBeNull();

  const markup = renderToStaticMarkup(<RootHtml>App</RootHtml>);
  return new DOMParser().parseFromString(markup, 'text/html');
};

describe('PWA shell', () => {
  test('links the install manifest from rendered HTML', () => {
    const document = renderRootHtml();

    expect(document.querySelector('link[rel="manifest"]')?.getAttribute('href')).toBe(
      '/manifest.json',
    );
  });

  test('registers the service worker after the page loads', () => {
    const document = renderRootHtml();
    const script = document.querySelector('script[data-register-sw]')?.textContent;
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
