module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
  testPathIgnorePatterns: ['/node_modules/', '/.expo/'],
  transformIgnorePatterns: [
    'node_modules/(?!(?:\\.pnpm/)?((jest-)?react-native(-.*)?|@react-native(-.*)?|expo(nent)?|@expo(nent)?/.*|@expo[+/]html-elements|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@gluestack-ui|@gluestack-ui/.*|@gluestack-style|@gluestack-style/.*|nativewind|@legendapp.*|standard-navigation|expo-modules-core|expo-router))',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
};
