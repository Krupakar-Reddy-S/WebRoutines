import { defineConfig } from 'vitest/config';

import { vitestAlias } from './vitest.shared';

export default defineConfig({
  resolve: {
    alias: vitestAlias,
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    clearMocks: true,
  },
});
