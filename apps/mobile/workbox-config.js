/* globals module */
module.exports = {
  globDirectory: 'dist',
  globPatterns: ['**/*.{js,css,html,png,svg,json,ico}'],
  swDest: 'dist/sw.js',
  maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
  runtimeCaching: [
    {
      urlPattern: /^https?:\/\/.*\/api\/.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        networkTimeoutSeconds: 5,
        expiration: { maxEntries: 50, maxAgeSeconds: 3600 },
      },
    },
  ],
};
