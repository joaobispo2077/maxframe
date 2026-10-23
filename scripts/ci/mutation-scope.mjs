import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

const EXCLUDED = 'src/infrastructure/youtube/InMemoryVideoMetadataGateway.ts';

const FLOOR_AND_GATE_SCRIPTS = new Set([
  'scripts/ci/quality-floors.mjs',
  'scripts/ci/mutation-scope.mjs',
  'scripts/ci/gate-metrics.mjs',
  'scripts/ci/check-ci-readiness.mjs',
  'scripts/ci/write-gate-json.mjs',
  'scripts/ci/accept-stryker-cache.mjs',
  'package.json',
  'package-lock.json',
]);

function normalizePath(file) {
  return String(file).replaceAll('\\', '/').replace(/^\.\//, '');
}

export function selectChangedMutants(files) {
  return (Array.isArray(files) ? files : []).filter((file) => {
    const path = normalizePath(file);
    if (!path.startsWith('src/')) return false;
    if (!path.endsWith('.ts')) return false;
    if (path.includes('.test.')) return false;
    if (path === EXCLUDED) return false;
    return true;
  });
}

export function isMutationConfig(file) {
  const path = normalizePath(file);
  const base = path.split('/').pop();
  if (base.startsWith('stryker.config.') && base.endsWith('.mjs')) return true;
  if (base === 'vitest.config.ts' || base === 'vitest.stryker.config.ts') {
    return true;
  }
  return FLOOR_AND_GATE_SCRIPTS.has(path);
}

export function isMutationRelevant(file) {
  const path = normalizePath(file);
  if (selectChangedMutants([path]).length > 0) return true;
  if (path === 'tests' || path.startsWith('tests/')) return true;
  if (path.includes('/tests/')) return true;
  return isMutationConfig(path);
}

export function diffNames(baseRef, options = {}) {
  const exec = options.exec ?? execFileSync;
  const range = options.range ?? `origin/${baseRef}...HEAD`;
  const out = exec('git', ['diff', '--name-only', '--no-renames', range], {
    encoding: 'utf8',
    cwd: options.cwd,
  });
  return out
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export function buildMutationScope({ baseRef, names, diffError = null }) {
  const changedFiles = selectChangedMutants(names);
  if (diffError) {
    return {
      mode: 'pr-profile',
      base: baseRef,
      changedFiles: [],
      mutableSourceChanged: null,
      runProfile: 'unavailable',
      scopeLabel: `PR mutate set src/**/*.ts. Changed file list unavailable (${diffError}).`,
    };
  }
  const relevant = (Array.isArray(names) ? names : []).filter((file) =>
    isMutationRelevant(file),
  );
  if (relevant.length === 0) {
    return {
      mode: 'pr-profile',
      base: baseRef,
      changedFiles: [],
      mutableSourceChanged: false,
      runProfile: 'skip',
      scopeLabel: 'No mutable source changed.',
    };
  }
  const testsOrConfig = relevant.some(
    (file) => selectChangedMutants([file]).length === 0,
  );
  if (testsOrConfig) {
    return {
      mode: 'pr-profile',
      base: baseRef,
      changedFiles: [],
      mutableSourceChanged: true,
      runProfile: 'fresh',
      scopeLabel:
        'Tests or mutation config changed. PR mutate set src/**/*.ts.',
    };
  }
  return {
    mode: 'changed-files',
    base: baseRef,
    changedFiles,
    mutableSourceChanged: true,
    runProfile: 'incremental',
    scopeLabel: `changed files: ${changedFiles.join(', ')}`,
  };
}

export function mutationDiffState(scope) {
  if (!scope || typeof scope !== 'object') return 'unavailable';
  if (scope.mutableSourceChanged === true) return 'changed';
  if (scope.mutableSourceChanged === false) return 'unchanged';
  return 'unavailable';
}

export function mutationMutableOutput(scope) {
  const state = mutationDiffState(scope);
  if (state === 'changed') return 'true';
  if (state === 'unchanged') return 'false';
  return 'unavailable';
}

export function writeMutationScope(
  scope,
  path = 'reports/quality/mutation-scope.json',
) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(scope, null, 2)}\n`);
  return path;
}

function isDirectRun() {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
}

if (isDirectRun()) {
  const baseRef =
    process.env.PR_BASE_REF || process.env.GITHUB_BASE_REF || 'develop';
  let scope;
  try {
    scope = buildMutationScope({ baseRef, names: diffNames(baseRef) });
  } catch (error) {
    scope = buildMutationScope({
      baseRef,
      names: [],
      diffError: error.message,
    });
  }
  const path = writeMutationScope(scope, process.env.MUTATION_SCOPE);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `mutable=${mutationMutableOutput(scope)}\nprofile=${scope.runProfile}\n`,
    );
  }
  console.log(scope.scopeLabel);
  console.log(`wrote ${path}`);
}
