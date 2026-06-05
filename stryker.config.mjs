import { strykerBaseConfig } from './stryker.config.base.mjs';

/**
 * Strict mutation profile — weekly full runs and local baseline.
 * Mutates all of `src/**` including static mutants and test doubles.
 *
 * @type {import('@stryker-mutator/api/core').PartialStrykerOptions}
 */
const config = {
  ...strykerBaseConfig,
  mutate: [
    // Keep mutation scope on root core source only (`@src` => `src/*`).
    // UI/static-mutant-heavy renderer code is excluded from this single-profile run.
    'src/**/*.ts',
    '!tests/**',
  ],
};

export default config;
