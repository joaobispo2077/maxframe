/**
 * @type {import('@stryker-mutator/api/core').PartialStrykerOptions}
 */
const config = {
  testRunner: 'vitest',
  checkers: [],
  concurrency: 2,
  vitest: {
    configFile: 'vitest.stryker.config.ts',
    related: true,
  },
  mutate: [
    'packages/renderer/src/**/*.ts',
    'packages/renderer/src/**/*.tsx',
    '!packages/renderer/tests/**',
    '!packages/renderer/src/main.tsx',
    'src/**/*.ts',
  ],
  reporters: ['html', 'json', 'clear-text', 'progress'],
  tempDirName: '.stryker-tmp',
  coverageAnalysis: 'perTest',
  thresholds: {
    high: 80,
    low: 60,
    /** Floor from 2026-04 baseline (~43% total); raise as tests kill mutants in renderer + ytdlp surfaces. */
    break: 42,
  },
  allowEmpty: false,
};

export default config;
