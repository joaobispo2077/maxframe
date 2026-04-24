import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './packages/renderer/src/test/setup.ts',
    include: ['packages/renderer/src/**/*.test.ts', 'packages/renderer/src/**/*.test.tsx'],
  },
});
