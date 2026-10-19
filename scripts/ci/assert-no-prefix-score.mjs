import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { assertPrefixRestoreHasNoScore } from './write-mutation-summary.mjs';

function isDirectRun() {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
}

if (isDirectRun()) {
  const decisionPath =
    process.env.STRYKER_CACHE_DECISION || 'reports/quality/stryker-cache.json';
  const summaryPath =
    process.env.MUTATION_SUMMARY || 'mutation-test-results.md';
  const incrementalFile =
    process.env.STRYKER_INCREMENTAL_FILE ||
    'reports/stryker-incremental.pr.json';
  const decision = JSON.parse(readFileSync(decisionPath, 'utf8'));
  const summary = readFileSync(summaryPath, 'utf8');
  const errors = assertPrefixRestoreHasNoScore(summary, decision, {
    exactKey: process.env.STRYKER_EXACT_KEY || '',
    staleMarker: process.env.STALE_SCORE_MARKER || 'STALE_PREFIX_SCORE_73.37',
  });
  if (existsSync(incrementalFile)) {
    errors.push('incremental file still present');
  }
  if (errors.length > 0) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  console.log('Prefix restore produced no mutation score.');
}
