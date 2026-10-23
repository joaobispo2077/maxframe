import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
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

export function parseKnipStdout(stdout) {
  const text = String(stdout || '').trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

function firstLine(text) {
  const line = String(text || '')
    .split('\n')
    .map((item) => item.trim())
    .find(Boolean);
  if (!line) return '';
  return line.slice(0, 180);
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
  const knipJsonPath = process.env.KNIP_JSON_OUT || 'reports/quality/knip.json';
  rmSync(knipJsonPath, { force: true });
  mkdirSync(dirname(knipJsonPath), { recursive: true });
  const reporter = join(process.cwd(), 'scripts/ci/knip-json-reporter.mjs');
  const run = spawnSync(bin, ['--reporter', reporter], {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    env: { ...process.env, KNIP_JSON_OUT: knipJsonPath },
  });
  let report = null;
  if (existsSync(knipJsonPath)) {
    try {
      report = JSON.parse(readFileSync(knipJsonPath, 'utf8'));
    } catch {
      report = null;
    }
  }
  if (!report) report = parseKnipStdout(run.stdout);
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
  if (!findings) {
    const detail = firstLine(run.stderr) || firstLine(run.stdout);
    if (detail) {
      result.value = `${result.value} ${detail}`;
    }
    if (run.stderr) console.error(run.stderr);
  }
  if (report) {
    result.evidenceSha256 = createHash('sha256')
      .update(JSON.stringify(report))
      .digest('hex');
  }
  process.exit(finishGate('deadcode', result));
}
