import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { mutationMetrics } from './gate-metrics.mjs';

export function isCacheOnlyScore(metrics) {
  if (!metrics || metrics.zeroMutants || metrics.countsUnknown) return false;
  return metrics.tested == null || metrics.tested === 0;
}

function isDirectRun() {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
}

if (isDirectRun()) {
  const reportPath =
    process.env.GATE_MUTATION_JSON || 'reports/mutation/mutation.json';
  const logPath = process.env.GATE_STRYKER_LOG || 'reports/quality/stryker.log';
  const decisionPath =
    process.env.GATE_STRYKER_CACHE_DECISION ||
    'reports/quality/stryker-cache.json';
  let report = null;
  let logText = '';
  let decision = null;
  try {
    report = JSON.parse(readFileSync(reportPath, 'utf8'));
  } catch {
    report = null;
  }
  try {
    logText = readFileSync(logPath, 'utf8');
  } catch {
    logText = '';
  }
  try {
    decision = JSON.parse(readFileSync(decisionPath, 'utf8'));
  } catch {
    decision = null;
  }
  const metrics = mutationMetrics({
    report,
    logText,
    profile: 'incremental',
    cacheDecision: decision,
  });
  if (isCacheOnlyScore(metrics)) {
    console.log('cache-only mutation score');
    process.exit(0);
  }
  console.log('mutation score includes mutants tested this run');
  process.exit(1);
}
