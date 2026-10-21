import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export function cypressResultsPayload(results) {
  if (!results || typeof results !== 'object') return null;
  if (results.status === 'failed' && !Number.isFinite(results.totalPassed)) {
    return {
      status: 'failed',
      message: results.message ?? null,
      failures: results.failures ?? null,
    };
  }
  if (
    !Number.isFinite(results.totalPassed) ||
    !Number.isFinite(results.totalFailed)
  ) {
    return null;
  }
  return {
    status: 'finished',
    totalTests: results.totalTests ?? null,
    totalPassed: results.totalPassed,
    totalFailed: results.totalFailed,
    totalPending: results.totalPending ?? 0,
    totalSkipped: results.totalSkipped ?? 0,
  };
}

export function writeCypressResults(
  results,
  path = 'reports/quality/cypress-results.json',
) {
  const payload = cypressResultsPayload(results);
  if (!payload) return null;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`);
  return path;
}
