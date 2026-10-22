import { MUTATION_BREAK } from './scripts/ci/quality-floors.mjs';

/**
 * Shared Stryker options for strict and PR fast profiles.
 * Profile-specific keys (`mutate`, `ignoreStatic`, `incrementalFile`) live in overlay configs.
 * The break floor lives only in scripts/ci/quality-floors.mjs.
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
    break: MUTATION_BREAK,
  },
  allowEmpty: false,
};
