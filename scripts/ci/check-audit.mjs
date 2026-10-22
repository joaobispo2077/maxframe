import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import { AUDIT_HIGH_CRITICAL_MAX } from './quality-floors.mjs';
import { finishGate } from './write-result.mjs';

export function auditCounts(report) {
  const counts = report?.metadata?.vulnerabilities;
  if (!counts || typeof counts !== 'object') return null;
  const high = counts.high;
  const critical = counts.critical;
  if (![high, critical].every((value) => Number.isFinite(value))) return null;
  return {
    high,
    critical,
    moderate: Number.isFinite(counts.moderate) ? counts.moderate : null,
    low: Number.isFinite(counts.low) ? counts.low : null,
    total: high + critical,
  };
}

export function evaluateAudit(
  report,
  maxHighCritical = AUDIT_HIGH_CRITICAL_MAX,
) {
  const floor = `<= ${maxHighCritical} high or critical`;
  const counts = auditCounts(report);
  if (!counts) {
    return {
      status: 'UNKNOWN',
      value: 'Dependency audit: UNKNOWN. Counts unavailable from this run.',
      floor,
      metrics: null,
    };
  }
  const moderate =
    counts.moderate == null ? '' : `, ${counts.moderate} moderate reported`;
  const low = counts.low == null ? '' : `, ${counts.low} low reported`;
  const value = `${counts.critical} critical, ${counts.high} high${moderate}${low}`;
  if (counts.total > maxHighCritical) {
    return {
      status: 'FAIL',
      value: `Dependency audit: FAIL. ${value} is above ${maxHighCritical}`,
      floor,
      metrics: counts,
    };
  }
  return { status: 'PASS', value, floor, metrics: counts };
}

function isDirectRun() {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
}

if (isDirectRun()) {
  const run = spawnSync('npm', ['audit', '--json'], {
    encoding: 'utf8',
    maxBuffer: 30 * 1024 * 1024,
  });
  let report = null;
  try {
    report = JSON.parse(run.stdout || '');
  } catch {
    report = null;
  }
  const result = evaluateAudit(report);
  if (run.stdout) {
    result.evidenceSha256 = createHash('sha256')
      .update(run.stdout)
      .digest('hex');
  }
  process.exit(finishGate('audit', result));
}
