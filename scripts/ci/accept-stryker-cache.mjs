import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

export function decideStrykerCache({
  cacheHit,
  matchedKey = '',
  incrementalText = null,
}) {
  const exact = cacheHit === true || cacheHit === 'true';
  const hadFile = typeof incrementalText === 'string';
  if (exact) {
    return {
      schemaVersion: 1,
      exact: true,
      matchedKey: matchedKey || null,
      scoreCountedFromCache: hadFile,
      incrementalFileRemoved: false,
      discardedSha256: null,
      reason: 'exact cache key',
    };
  }
  return {
    schemaVersion: 1,
    exact: false,
    matchedKey: matchedKey || null,
    scoreCountedFromCache: false,
    incrementalFileRemoved: hadFile,
    discardedSha256: hadFile
      ? createHash('sha256').update(incrementalText).digest('hex')
      : null,
    reason: hadFile
      ? 'prefix or other non-exact restore does not count as a mutation score'
      : 'no exact cache restore',
  };
}

export function applyStrykerCacheDecision({
  cacheHit,
  matchedKey,
  incrementalFile,
  decisionFile,
}) {
  const incrementalText = existsSync(incrementalFile)
    ? readFileSync(incrementalFile, 'utf8')
    : null;
  const decision = decideStrykerCache({
    cacheHit,
    matchedKey,
    incrementalText,
  });
  if (decision.incrementalFileRemoved) unlinkSync(incrementalFile);
  mkdirSync(dirname(decisionFile), { recursive: true });
  writeFileSync(decisionFile, `${JSON.stringify(decision, null, 2)}\n`);
  return decision;
}

function isDirectRun() {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
}

if (isDirectRun()) {
  const decision = applyStrykerCacheDecision({
    cacheHit: process.env.STRYKER_CACHE_HIT ?? '',
    matchedKey: process.env.STRYKER_CACHE_MATCHED_KEY ?? '',
    incrementalFile:
      process.env.STRYKER_INCREMENTAL_FILE ||
      'reports/stryker-incremental.pr.json',
    decisionFile:
      process.env.STRYKER_CACHE_DECISION ||
      'reports/quality/stryker-cache.json',
  });
  console.log(decision.reason);
  if (!decision.exact) {
    console.log('No mutation score counted from cache.');
  }
}
