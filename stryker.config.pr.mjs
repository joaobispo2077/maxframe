import { existsSync, readFileSync } from 'node:fs';

import { strykerBaseConfig } from './stryker.config.base.mjs';

const defaultMutate = [
  'src/**/*.ts',
  '!tests/**',
  '!src/infrastructure/youtube/InMemoryVideoMetadataGateway.ts',
];

function mutatePatterns() {
  const path = 'reports/quality/mutation-scope.json';
  if (!existsSync(path)) return defaultMutate;
  try {
    const scope = JSON.parse(readFileSync(path, 'utf8'));
    if (
      scope?.mode === 'changed-files' &&
      Array.isArray(scope.changedFiles) &&
      scope.changedFiles.length > 0
    ) {
      return [
        ...scope.changedFiles,
        '!src/infrastructure/youtube/InMemoryVideoMetadataGateway.ts',
      ];
    }
  } catch {
    return defaultMutate;
  }
  return defaultMutate;
}

/**
 * PR light mutation profile.
 * Incremental on changed files when the scope file lists any.
 * Otherwise the whole PR mutate set, still incremental.
 *
 * @type {import('@stryker-mutator/api/core').PartialStrykerOptions}
 */
const config = {
  ...strykerBaseConfig,
  ignoreStatic: true,
  incrementalFile: 'reports/stryker-incremental.pr.json',
  mutate: mutatePatterns(),
};

export default config;
