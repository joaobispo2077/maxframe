import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { FIND_DUPES_MAX } from './quality-floors.mjs';
import { finishGate } from './write-result.mjs';

const UNKNOWN = 'Dependency tree: UNKNOWN. Counts unavailable from this run.';

function byCodePoint(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function dependencyTreeFloor(ceiling = FIND_DUPES_MAX) {
  return `<= ${ceiling} packages`;
}

export function packageNameFromLockPath(lockPath) {
  if (typeof lockPath !== 'string' || lockPath.length === 0) return null;
  const marker = 'node_modules/';
  const at = lockPath.lastIndexOf(marker);
  if (at < 0) return null;
  const name = lockPath.slice(at + marker.length);
  if (!name || name.startsWith('.')) return null;
  return name;
}

export function duplicatesFromLock(lock) {
  const packages = lock?.packages;
  if (!packages || typeof packages !== 'object' || Array.isArray(packages)) {
    return null;
  }
  const byName = new Map();
  for (const [lockPath, meta] of Object.entries(packages)) {
    if (!meta || typeof meta !== 'object' || meta.link) continue;
    const name = packageNameFromLockPath(lockPath);
    const version = meta.version;
    if (!name || typeof version !== 'string' || version.length === 0) {
      continue;
    }
    if (!byName.has(name)) byName.set(name, new Set());
    byName.get(name).add(version);
  }
  const duplicates = [];
  for (const [name, versions] of byName) {
    if (versions.size < 2) continue;
    duplicates.push({
      name,
      versions: [...versions].sort(byCodePoint),
    });
  }
  duplicates.sort((left, right) => byCodePoint(left.name, right.name));
  return duplicates;
}

export function dependencyTreeEvidence(duplicates) {
  return JSON.stringify({
    duplicatePackages: duplicates.length,
    packages: duplicates,
  });
}

export function evaluateDependencyTree(duplicates, ceiling = FIND_DUPES_MAX) {
  const floor = dependencyTreeFloor(ceiling);
  if (!Array.isArray(duplicates)) {
    return {
      status: 'UNKNOWN',
      value: UNKNOWN,
      floor,
      metrics: null,
    };
  }
  const metrics = {
    duplicatePackages: duplicates.length,
    packages: duplicates,
  };
  const value = `${duplicates.length} packages resolved at more than one version`;
  if (duplicates.length > ceiling) {
    return {
      status: 'FAIL',
      value: `Dependency tree: FAIL. ${value} is above ${ceiling}`,
      floor,
      metrics,
    };
  }
  return { status: 'PASS', value, floor, metrics };
}

function loadLock(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function isDirectRun() {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
}

if (isDirectRun()) {
  const lock = loadLock(process.env.FIND_DUPES_LOCK || 'package-lock.json');
  const duplicates = lock ? duplicatesFromLock(lock) : null;
  const result = evaluateDependencyTree(duplicates);
  if (Array.isArray(duplicates)) {
    result.evidenceSha256 = createHash('sha256')
      .update(dependencyTreeEvidence(duplicates))
      .digest('hex');
  }
  process.exit(finishGate('find-dupes', result));
}
