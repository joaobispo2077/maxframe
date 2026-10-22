import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

const EXCLUDED = 'src/infrastructure/youtube/InMemoryVideoMetadataGateway.ts';

export function selectChangedMutants(files) {
  return (Array.isArray(files) ? files : []).filter((file) => {
    const path = String(file).replaceAll('\\', '/').replace(/^\.\//, '');
    if (!path.startsWith('src/')) return false;
    if (!path.endsWith('.ts')) return false;
    if (path.includes('.test.')) return false;
    if (path === EXCLUDED) return false;
    return true;
  });
}

export function diffNames(baseRef) {
  const out = execFileSync(
    'git',
    ['diff', '--name-only', `origin/${baseRef}...HEAD`, '--', 'src'],
    { encoding: 'utf8' },
  );
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
      scopeLabel: `PR mutate set src/**/*.ts. Changed file list unavailable (${diffError}).`,
    };
  }
  if (changedFiles.length === 0) {
    return {
      mode: 'pr-profile',
      base: baseRef,
      changedFiles: [],
      mutableSourceChanged: false,
      scopeLabel: 'No mutable source changed.',
    };
  }
  return {
    mode: 'changed-files',
    base: baseRef,
    changedFiles,
    mutableSourceChanged: true,
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
      `mutable=${mutationMutableOutput(scope)}\n`,
    );
  }
  console.log(scope.scopeLabel);
  console.log(`wrote ${path}`);
}
