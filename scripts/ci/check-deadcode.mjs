import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { finishGate } from './write-result.mjs';

const KINDS = [
  'files',
  'dependencies',
  'devDependencies',
  'exports',
  'types',
  'duplicates',
  'unlisted',
  'unresolved',
  'enumMembers',
  'namespaceMembers',
  'binaries',
  'optionalPeerDependencies',
  'catalog',
];

export function deadcodeKey(kind, file, name) {
  return `${kind}\t${file}\t${name}`;
}

export function flattenKnip(report) {
  const issues = Array.isArray(report?.issues)
    ? report.issues
    : Array.isArray(report)
      ? report
      : null;
  if (!issues) return null;
  const items = [];
  for (const issue of issues) {
    const file = issue?.file ?? '';
    for (const kind of KINDS) {
      const entries = issue?.[kind];
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        const name =
          typeof entry === 'string'
            ? entry
            : (entry?.name ?? JSON.stringify(entry));
        items.push(deadcodeKey(kind, file, name));
      }
    }
  }
  return items;
}

export function loadAllowlist(payload) {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  return new Set(items.map((item) => String(item)));
}

export function evaluateDeadcode(findings, allowlist) {
  const floor = '0 unwaived';
  if (!findings) {
    return {
      status: 'UNKNOWN',
      value: 'Dead code: UNKNOWN. Counts unavailable from this run.',
      floor,
      metrics: null,
    };
  }
  const unwaived = findings.filter((item) => !allowlist.has(item));
  const metrics = {
    unwaived: unwaived.length,
    allowlisted: allowlist.size,
    total: findings.length,
  };
  const value = `${unwaived.length} unwaived, ${allowlist.size} allowlisted`;
  if (unwaived.length > 0) {
    return {
      status: 'FAIL',
      value: `Dead code: FAIL. ${value}. ${unwaived.slice(0, 20).join('; ')}`,
      floor,
      metrics,
      unwaived,
    };
  }
  return { status: 'PASS', value, floor, metrics };
}

function isDirectRun() {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
}

if (isDirectRun()) {
  const bin = join(process.cwd(), 'node_modules', '.bin', 'knip');
  const allowPath =
    process.env.DEADCODE_ALLOWLIST || 'scripts/ci/deadcode-allowlist.json';
  if (!existsSync(bin)) {
    process.exit(
      finishGate('deadcode', {
        status: 'UNKNOWN',
        value: 'Dead code: UNKNOWN. knip is not installed.',
        floor: '0 unwaived',
        metrics: null,
      }),
    );
  }
  const run = spawnSync(bin, ['--reporter', 'json'], {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  let report = null;
  try {
    report = JSON.parse(run.stdout || '');
  } catch {
    report = null;
  }
  let allowlist;
  try {
    allowlist = loadAllowlist(JSON.parse(readFileSync(allowPath, 'utf8')));
  } catch {
    process.exit(
      finishGate('deadcode', {
        status: 'UNKNOWN',
        value: 'Dead code: UNKNOWN. Allowlist is missing or unreadable.',
        floor: '0 unwaived',
        metrics: null,
      }),
    );
  }
  const findings = flattenKnip(report);
  const result = evaluateDeadcode(findings, allowlist);
  if (run.stdout) {
    result.evidenceSha256 = createHash('sha256')
      .update(run.stdout)
      .digest('hex');
  }
  process.exit(finishGate('deadcode', result));
}
