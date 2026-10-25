import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  dependencyTreeEvidence,
  duplicatesFromLock,
  evaluateDependencyTree,
  packageNameFromLockPath,
} from '../../scripts/ci/check-find-dupes.mjs';
import { FIND_DUPES_MAX } from '../../scripts/ci/quality-floors.mjs';

const root = resolve(import.meta.dirname, '../..');

function lockWith(duplicateNames: string[]) {
  const packages: Record<string, { version: string; link?: boolean }> = {
    '': { version: '1.0.0' },
    'packages/main': { version: '1.0.0' },
    'node_modules/@maxframe/main': { version: '1.0.0', link: true },
    'node_modules/once': { version: '1.0.0' },
    'node_modules/pkg/node_modules/once': { version: '1.0.0' },
  };
  for (const name of duplicateNames) {
    packages[`node_modules/${name}`] = { version: '1.0.0' };
    packages[`node_modules/holder/node_modules/${name}`] = { version: '2.0.0' };
  }
  return { lockfileVersion: 3, packages };
}

function names(count: number) {
  return Array.from({ length: count }, (_, index) => `pkg-${index}`);
}

function runScript(lock: unknown) {
  const dir = mkdtempSync(join(tmpdir(), 'find-dupes-'));
  const lockPath = join(dir, 'package-lock.json');
  const resultPath = join(dir, 'find-dupes.json');
  if (lock !== 'missing') {
    writeFileSync(lockPath, lock === 'bad' ? '{' : JSON.stringify(lock));
  }
  const result = spawnSync(
    process.execPath,
    ['scripts/ci/check-find-dupes.mjs'],
    {
      cwd: root,
      env: {
        ...process.env,
        FIND_DUPES_LOCK:
          lock === 'missing' ? join(dir, 'absent.json') : lockPath,
        GATE_RESULT: resultPath,
      },
      encoding: 'utf8',
    },
  );
  const written = JSON.parse(readFileSync(resultPath, 'utf8')) as {
    status: string;
    value: string;
    floor: string;
    evidenceSha256: string | null;
    evidencePath?: string | null;
    metrics: { duplicatePackages: number } | null;
  };
  return { result, written };
}

describe('dependency tree gate', () => {
  it('counts a package name once when it has several versions', () => {
    expect(packageNameFromLockPath('packages/main')).toBeNull();
    expect(
      packageNameFromLockPath('node_modules/holder/node_modules/@scope/pkg'),
    ).toBe('@scope/pkg');
    const duplicates = duplicatesFromLock({
      packages: {
        'packages/main': { version: '1.0.0' },
        'node_modules/@maxframe/main': { version: '1.0.0', link: true },
        'node_modules/once': { version: '1.0.0' },
        'node_modules/pkg/node_modules/once': { version: '1.0.0' },
        'node_modules/@scope/pkg': { version: '2.0.0' },
        'node_modules/a/node_modules/@scope/pkg': { version: '1.0.0' },
        'node_modules/b/node_modules/@scope/pkg': { version: '3.0.0' },
      },
    });
    expect(duplicates).toEqual([
      { name: '@scope/pkg', versions: ['1.0.0', '2.0.0', '3.0.0'] },
    ]);
    expect(evaluateDependencyTree(duplicates).status).toBe('PASS');
    expect(evaluateDependencyTree(duplicates).metrics?.duplicatePackages).toBe(
      1,
    );
  });

  it('fails above the ceiling and passes on it and under it', () => {
    const onCeiling = duplicatesFromLock(lockWith(names(FIND_DUPES_MAX)));
    expect(onCeiling).toHaveLength(FIND_DUPES_MAX);
    const onResult = evaluateDependencyTree(onCeiling);
    expect(onResult.status).toBe('PASS');
    expect(onResult.floor).toBe(`<= ${FIND_DUPES_MAX} packages`);
    expect(onResult.value).toBe(
      `${FIND_DUPES_MAX} packages resolved at more than one version`,
    );
    const onRun = runScript(lockWith(names(FIND_DUPES_MAX)));
    expect(onRun.result.status).toBe(0);
    expect(onRun.written.status).toBe('PASS');
    expect(onRun.result.stdout).toContain(
      `${FIND_DUPES_MAX} packages resolved at more than one version`,
    );
    expect(onRun.result.stdout).not.toContain('FAIL');
    expect(onRun.written.evidenceSha256).toMatch(/^[a-f0-9]{64}$/);

    const under = evaluateDependencyTree(
      duplicatesFromLock(lockWith(['only'])),
    );
    expect(under.status).toBe('PASS');
    expect(under.metrics?.duplicatePackages).toBe(1);
    const underRun = runScript(lockWith(['only']));
    expect(underRun.result.status).toBe(0);
    expect(underRun.written.status).toBe('PASS');

    const over = duplicatesFromLock(lockWith(names(FIND_DUPES_MAX + 1)));
    expect(over).toHaveLength(FIND_DUPES_MAX + 1);
    const overResult = evaluateDependencyTree(over);
    expect(overResult.status).toBe('FAIL');
    expect(overResult.status).not.toBe('PASS');
    expect(overResult.value).toContain(
      `${FIND_DUPES_MAX + 1} packages resolved at more than one version is above ${FIND_DUPES_MAX}`,
    );
    const overRun = runScript(lockWith(names(FIND_DUPES_MAX + 1)));
    expect(overRun.result.status).not.toBe(0);
    expect(overRun.written.status).toBe('FAIL');
    expect(overRun.written.status).not.toBe('PASS');
    expect(overRun.result.stdout).toContain('find-dupes: FAIL');
    expect(overRun.result.stdout).toContain(
      `${FIND_DUPES_MAX + 1} packages resolved at more than one version is above ${FIND_DUPES_MAX}`,
    );
    expect(overRun.written.evidenceSha256).toBe(
      createHash('sha256').update(dependencyTreeEvidence(over)).digest('hex'),
    );
    expect(overRun.written.evidencePath).toBe(
      'reports/quality/evidence/lockfile-duplicates.json',
    );
    expect(
      createHash('sha256')
        .update(readFileSync(join(root, overRun.written.evidencePath), 'utf8'))
        .digest('hex'),
    ).toBe(overRun.written.evidenceSha256);
  });

  it('does not pass when the lockfile cannot be read', () => {
    expect(duplicatesFromLock(null)).toBeNull();
    expect(duplicatesFromLock({})).toBeNull();
    expect(evaluateDependencyTree(null).status).toBe('UNKNOWN');
    expect(evaluateDependencyTree(null).status).not.toBe('PASS');

    for (const lock of ['missing', 'bad', { name: 'no-packages' }] as const) {
      const { result, written } = runScript(lock);
      expect(result.status).not.toBe(0);
      expect(written.status).toBe('UNKNOWN');
      expect(written.status).not.toBe('PASS');
      expect(written.value).toContain('Counts unavailable');
      expect(written.evidenceSha256 ?? null).toBeNull();
    }
  });

  it('measures the develop lockfile at the recorded ceiling', () => {
    const lock = JSON.parse(
      readFileSync(join(root, 'package-lock.json'), 'utf8'),
    );
    const duplicates = duplicatesFromLock(lock);
    expect(duplicates).toHaveLength(FIND_DUPES_MAX);
    expect(evaluateDependencyTree(duplicates).status).toBe('PASS');
    const { result, written } = runScript(lock);
    expect(result.status).toBe(0);
    expect(written.status).toBe('PASS');
    expect(written.metrics?.duplicatePackages).toBe(FIND_DUPES_MAX);
    expect(written.floor).toBe(`<= ${FIND_DUPES_MAX} packages`);
    expect(written.evidenceSha256).toMatch(/^[a-f0-9]{64}$/);
  });
});
