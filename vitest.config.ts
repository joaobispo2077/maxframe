import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

import { COVERAGE_FLOORS } from './scripts/ci/quality-floors.mjs';

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
    coverage: {
      provider: 'v8',
      reporter: ['json-summary', 'json', 'cobertura', 'text'],
      exclude: [
        'scripts/**',
        'coverage/**',
        'dist/**',
        'reports/**',
        '**/*.{png,svg,html}',
      ],
      excludeAfterRemap: true,
      reportOnFailure: true,
      thresholds: {
        statements: COVERAGE_FLOORS.statements,
        branches: COVERAGE_FLOORS.branches,
        functions: COVERAGE_FLOORS.functions,
        lines: COVERAGE_FLOORS.lines,
      },
    },
  },
});
