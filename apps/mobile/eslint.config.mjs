//@ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
//@ts-ignore
import reactNative from 'eslint-plugin-react-native';
import prettierConfig from 'eslint-config-prettier';

/**@type {any} */
const reactNativeAny = reactNative;

/** @type {import('eslint').Linter.Config[]} */
export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    plugins: {
      react: reactPlugin,
      'react-native': reactNativeAny,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,

      'react/react-in-jsx-scope': 'off',
      'react-native/no-inline-styles': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },

  prettierConfig,
  {
    ignores: ['node_modules/', '.expo/', 'dist/', 'ios/', 'android/'],
  },
];
