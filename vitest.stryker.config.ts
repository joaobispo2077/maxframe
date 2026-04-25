import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './packages/renderer/tests/setup.ts',
    include: [
      'packages/renderer/tests/**/*.test.ts',
      'packages/renderer/tests/**/*.test.tsx',
    ],
  },
});
