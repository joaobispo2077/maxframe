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
    '!packages/renderer/src/**/*.test.tsx',
    '!packages/renderer/src/test/**',
    '!packages/renderer/src/main.tsx',
  ],
  reporters: ['html', 'clear-text', 'progress'],
  tempDirName: '.stryker-tmp',
  coverageAnalysis: 'off',
  thresholds: {
    high: 80,
    low: 60,
    break: 50,
  },
  allowEmpty: false,
};

export default config;
