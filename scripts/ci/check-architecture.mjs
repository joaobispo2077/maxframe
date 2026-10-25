import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { createHash } from 'node:crypto';

import { finishGate } from './write-result.mjs';

export const ARCHITECTURE_CONTRACTS = [
  'domain-does-not-import-infrastructure',
  'renderer-does-not-import-main',
  'renderer-does-not-import-node',
];

export function evaluateArchitecture(report) {
  const floor = '0 violations';
  const summary = report?.summary;
  if (!summary || typeof summary.error !== 'number') {
    return {
      status: 'UNKNOWN',
      value: 'Architecture: UNKNOWN. Counts unavailable from this run.',
      floor,
      metrics: null,
    };
  }
  const violations = [];
  for (const mod of report.modules ?? []) {
    for (const dep of mod.dependencies ?? []) {
      const rules = dep.rules ?? (dep.rule ? [dep.rule] : []);
      if (
        dep.valid === false ||
        (Array.isArray(rules) && rules.length > 0 && dep.valid !== true)
      ) {
        if (dep.valid === false) {
          violations.push(
            `${mod.source} -> ${dep.resolved || dep.module} (${rules.map((rule) => rule.name || rule).join(', ') || 'forbidden'})`,
          );
        }
      }
    }
  }
  const errorCount = summary.error;
  const metrics = {
    violations: errorCount,
    contracts: ARCHITECTURE_CONTRACTS.length,
  };
  const value = `${errorCount} violations, ${ARCHITECTURE_CONTRACTS.length} contracts`;
  if (errorCount > 0 || violations.length > 0) {
    const detail = violations.slice(0, 10).join('; ');
    return {
      status: 'FAIL',
      value: detail
        ? `Architecture: FAIL. ${value}. ${detail}`
        : `Architecture: FAIL. ${value}`,
      floor,
      metrics,
    };
  }
  return { status: 'PASS', value, floor, metrics };
}

function isDirectRun() {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
}

if (isDirectRun()) {
  const bin = join(process.cwd(), 'node_modules', '.bin', 'depcruise');
  if (!existsSync(bin)) {
    process.exit(
      finishGate('architecture', {
        status: 'UNKNOWN',
        value: 'Architecture: UNKNOWN. dependency-cruiser is not installed.',
        floor: '0 violations',
        metrics: null,
      }),
    );
  }
  const run = spawnSync(
    bin,
    [
      '--config',
      '.dependency-cruiser.mjs',
      '--output-type',
      'json',
      'src',
      'packages/renderer/src',
      'packages/main/src',
    ],
    { encoding: 'utf8', maxBuffer: 30 * 1024 * 1024 },
  );
  let report = null;
  try {
    report = JSON.parse(run.stdout || '');
  } catch {
    report = null;
  }
  const result = evaluateArchitecture(report);
  if (run.stdout) {
    const evidencePath = join(
      'reports/quality/evidence',
      'dependency-cruiser.json',
    );
    mkdirSync(dirname(evidencePath), { recursive: true });
    writeFileSync(evidencePath, run.stdout);
    result.evidenceSha256 = createHash('sha256')
      .update(run.stdout)
      .digest('hex');
    result.evidencePath = evidencePath;
  }
  process.exit(finishGate('architecture', result));
}
