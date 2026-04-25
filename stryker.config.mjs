/**
 * @type {import('@stryker-mutator/api/core').PartialStrykerOptions}
 */
const config = {
  testRunner: 'vitest',
  checkers: [],
  vitest: {
    configFile: 'vitest.stryker.config.ts',
    related: false,
  },
  mutate: [
    'packages/renderer/src/**/*.ts',
    'packages/renderer/src/**/*.tsx',
    '!packages/renderer/src/**/*.test.ts',
    '!packages/renderer/src/**/*.test.tsx',
    '!packages/renderer/tests/**',
    '!packages/renderer/src/main.tsx',
    'src/**/*.ts',
  ],
  reporters: ['html', 'clear-text', 'progress'],
  tempDirName: '.stryker-tmp',
  coverageAnalysis: 'off',
  thresholds: {
    high: 80,
    low: 60,
    /** Floor from 2026-04 baseline (~43% total); raise as tests kill mutants in renderer + ytdlp surfaces. */
    break: 42,
  },
  allowEmpty: false,
};

export default config;
