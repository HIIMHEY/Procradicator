module.exports = {
  globDirectory: 'dist',
  globPatterns: ['**/*.{js,css,html,png,svg,json,ico}'],
  swDest: 'dist/sw.js',
  maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
  navigateFallback: '/index.html',
};
