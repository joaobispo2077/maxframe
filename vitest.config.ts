import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@src': resolve(__dirname, 'src'),
      '@ui': resolve(__dirname, 'packages/renderer/src'),
      '@tests': resolve(__dirname, 'tests'),
      '@ui-tests': resolve(__dirname, 'packages/renderer/tests'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './packages/renderer/tests/setup.ts',
    include: [
      'tests/**/*.test.ts',
      'packages/renderer/tests/**/*.test.ts',
      'packages/renderer/tests/**/*.test.tsx',
    ],
    environmentMatchGlobs: [['tests/**', 'node']],
  },
});
