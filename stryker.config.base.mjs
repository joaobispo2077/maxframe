/**
 * Shared Stryker options for strict and PR fast profiles.
 * Profile-specific keys (`mutate`, `ignoreStatic`, `incrementalFile`) live in overlay configs.
 *
 * @type {import('@stryker-mutator/api/core').PartialStrykerOptions}
 */
export const strykerBaseConfig = {
  testRunner: 'vitest',
  checkers: [],
  concurrency: 2,
  vitest: {
    configFile: 'vitest.stryker.config.ts',
    related: true,
  },
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
