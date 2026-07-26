import { jest } from '@jest/globals';

interface RuntimeCache {
  method?: string;
}

interface WorkboxConfig {
  navigateFallback?: string;
  runtimeCaching: RuntimeCache[];
}

const config = jest.requireActual<WorkboxConfig>('../../workbox-config.js');

describe('Workbox config', () => {
  test('serves the precached app shell for offline navigations', () => {
    expect(config.navigateFallback).toBe('/index.html');
  });

  test('does not runtime-cache authenticated reads', () => {
    expect(
      config.runtimeCaching.every(({ method }) => method !== undefined && method !== 'GET'),
    ).toBe(true);
  });
});
