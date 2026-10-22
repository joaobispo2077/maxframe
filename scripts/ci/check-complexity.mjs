import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { evaluateComplexity, measureFunctions } from './crap.mjs';
import { finishGate } from './write-result.mjs';

function loadAllowlist(path) {
  const payload = JSON.parse(readFileSync(path, 'utf8'));
  return new Set(Array.isArray(payload.items) ? payload.items.map(String) : []);
}

function isDirectRun() {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
}

if (isDirectRun()) {
  const coveragePath =
    process.env.GATE_COVERAGE_FINAL || 'coverage/coverage-final.json';
  const allowPath =
    process.env.CRAP_ALLOWLIST || 'scripts/ci/crap-allowlist.json';
  let coverage = null;
  if (existsSync(coveragePath)) {
    try {
      coverage = JSON.parse(readFileSync(coveragePath, 'utf8'));
    } catch {
      coverage = null;
    }
  }
  let allowlist;
  try {
    allowlist = loadAllowlist(allowPath);
  } catch {
    process.exit(
      finishGate('complexity', {
        status: 'UNKNOWN',
        value:
          'CRAP / complexity: UNKNOWN. Allowlist is missing or unreadable.',
        floor: 'complexity <= 12, CRAP <= 30, 0 new over the line',
        metrics: null,
      }),
    );
  }
  if (!coverage) {
    process.exit(
      finishGate(
        'complexity',
        evaluateComplexity(
          { functions: [], coveragePresent: false, parseErrors: [] },
          allowlist,
        ),
      ),
    );
  }
  const measured = await measureFunctions(process.cwd(), coverage);
  const result = evaluateComplexity(
    { ...measured, coveragePresent: true },
    allowlist,
  );
  result.evidenceSha256 = createHash('sha256')
    .update(readFileSync(coveragePath))
    .digest('hex');
  result.evidencePath = coveragePath;
  process.exit(finishGate('complexity', result));
}
