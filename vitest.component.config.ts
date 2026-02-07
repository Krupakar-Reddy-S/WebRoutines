import { defineConfig } from 'vitest/config';

import { vitestAlias } from './vitest.shared';

export default defineConfig({
  resolve: {
    alias: vitestAlias,
  },
  test: {
    environment: 'jsdom',
    include: ['tests/component/**/*.test.tsx'],
    setupFiles: ['tests/component/setup.ts'],
    clearMocks: true,
  },
});
