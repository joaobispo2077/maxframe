import { strykerBaseConfig } from './stryker.config.base.mjs';

/**
 * PR fast mutation profile — promotion PR CI (`develop` → `release`).
 * Ignores static mutants and excludes the InMemory metadata test double.
 *
 * @type {import('@stryker-mutator/api/core').PartialStrykerOptions}
 */
const config = {
  ...strykerBaseConfig,
  ignoreStatic: true,
  incrementalFile: 'reports/stryker-incremental.pr.json',
  mutate: [
    'src/**/*.ts',
    '!tests/**',
    '!src/infrastructure/youtube/InMemoryVideoMetadataGateway.ts',
  ],
};

export default config;
