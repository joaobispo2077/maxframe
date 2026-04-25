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
    // Keep mutation scope on root core source only (`@src` => `src/*`).
    // UI/static-mutant-heavy renderer code is excluded from this single-profile run.
    'src/**/*.ts',
    '!tests/**',
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
