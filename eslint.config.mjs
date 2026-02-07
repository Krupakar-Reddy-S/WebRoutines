import tsParser from '@typescript-eslint/parser';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

const reactHooksRules = {
  ...reactHooks.configs.recommended.rules,
  ...(reactHooks.configs['recommended-latest']?.rules ?? {}),
};

export default [
  {
    ignores: ['node_modules/**', '.output/**', '.wxt/**'],
  },
  {
    files: ['**/*.{js,jsx,ts,tsx,mjs,cjs}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.webextensions,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: reactHooksRules,
  },
];
