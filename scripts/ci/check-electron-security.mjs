import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

import { createHash } from 'node:crypto';

import { ELECTRON_SECURITY_FLOOR } from './quality-floors.mjs';
import { finishGate } from './write-result.mjs';

const ROOTS = [
  'packages/main/src',
  'packages/preload/src',
  'packages/renderer/src',
];

export function evaluateElectronSecurity(files) {
  const floor = ELECTRON_SECURITY_FLOOR;
  if (!Array.isArray(files) || files.length === 0) {
    return {
      status: 'UNKNOWN',
      value: 'Electron security: UNKNOWN. No source files were read.',
      floor,
      metrics: null,
    };
  }
  const problems = [];
  const windows = files.filter((file) =>
    /new\s+BrowserWindow\s*\(/.test(file.text),
  );
  if (windows.length === 0) {
    return {
      status: 'UNKNOWN',
      value: 'Electron security: UNKNOWN. No BrowserWindow was found.',
      floor,
      metrics: null,
    };
  }
  for (const file of files) {
    if (/sandbox\s*:\s*false/.test(file.text)) {
      problems.push(`${file.path}: sandbox is false`);
    }
    if (/nodeIntegration\s*:\s*true/.test(file.text)) {
      problems.push(`${file.path}: nodeIntegration is true`);
    }
    if (/contextIsolation\s*:\s*false/.test(file.text)) {
      problems.push(`${file.path}: contextIsolation is false`);
    }
  }
  for (const file of windows) {
    if (!/contextIsolation\s*:\s*true/.test(file.text)) {
      problems.push(`${file.path}: contextIsolation is not true`);
    }
    if (!/nodeIntegration\s*:\s*false/.test(file.text)) {
      problems.push(`${file.path}: nodeIntegration is not false`);
    }
    if (!/sandbox\s*:\s*true/.test(file.text)) {
      problems.push(`${file.path}: sandbox is not true`);
    }
  }
  const metrics = { windows: windows.length, problems: problems.length };
  if (problems.length > 0) {
    return {
      status: 'FAIL',
      value: `Electron security: FAIL. ${problems.join('; ')}`,
      floor,
      metrics,
    };
  }
  return {
    status: 'PASS',
    value: ELECTRON_SECURITY_FLOOR,
    floor,
    metrics,
  };
}

function walk(dir, acc) {
  let entries = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    const path = join(dir, name);
    let info;
    try {
      info = statSync(path);
    } catch {
      continue;
    }
    if (info.isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue;
      walk(path, acc);
      continue;
    }
    if (
      !name.endsWith('.ts') &&
      !name.endsWith('.tsx') &&
      !name.endsWith('.mjs')
    ) {
      continue;
    }
    acc.push(path);
  }
}

export function readSecuritySources(root = process.cwd()) {
  const files = [];
  for (const dir of ROOTS) {
    const abs = join(root, dir);
    const paths = [];
    walk(abs, paths);
    for (const path of paths) {
      files.push({
        path: relative(root, path).replaceAll('\\', '/'),
        text: readFileSync(path, 'utf8'),
      });
    }
  }
  return files;
}

function isDirectRun() {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
}

if (isDirectRun()) {
  const files = readSecuritySources();
  const result = evaluateElectronSecurity(files);
  const hash = createHash('sha256');
  for (const file of files) hash.update(file.path).update(file.text);
  result.evidenceSha256 = hash.digest('hex');
  process.exit(finishGate('electron-security', result));
}
