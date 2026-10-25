import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { measureFunctions } from './crap.mjs';
import {
  CRAP_MAX,
  CRAP_MAX_SCORE,
  CRAP_OVER_30_MAX,
  crapTopFloorLabel,
} from './quality-floors.mjs';
import { finishGate } from './write-result.mjs';

export const CRAP_EVIDENCE_PATH = join('reports/quality/evidence', 'crap.json');

const UNKNOWN_COVERAGE =
  'CRAP top 10: UNKNOWN. coverage-final.json is missing or unreadable.';
const UNKNOWN_COUNTS =
  'CRAP top 10: UNKNOWN. Counts unavailable from this run.';

function byCodePoint(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function roundCrap(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.round(number * 100) / 100;
}

export function rankProblem(functions) {
  if (!Array.isArray(functions)) return 'counts unavailable';
  for (const item of functions) {
    if (item?.coveragePct == null) return 'a function has no coverage';
    const crap = roundCrap(item?.crap);
    const coverage = roundCrap(item.coveragePct);
    const complexity = item?.complexity;
    if (crap == null || coverage == null) {
      return 'a function has a non-finite CRAP or coverage';
    }
    if (typeof complexity !== 'number' || !Number.isFinite(complexity)) {
      return 'a function has a non-finite complexity';
    }
  }
  return null;
}

export function rankFunctions(functions) {
  const ranked = [];
  for (const item of Array.isArray(functions) ? functions : []) {
    const crap = roundCrap(item?.crap);
    const coverage = roundCrap(item.coveragePct);
    ranked.push({
      file: String(item.file ?? ''),
      name: String(item.name ?? ''),
      line: Number(item.line ?? 0),
      complexity: item.complexity,
      coverage,
      crap,
    });
  }
  ranked.sort((left, right) => {
    if (left.crap !== right.crap) return right.crap - left.crap;
    const file = byCodePoint(left.file, right.file);
    if (file !== 0) return file;
    const name = byCodePoint(left.name, right.name);
    if (name !== 0) return name;
    return left.line - right.line;
  });
  return ranked;
}

export function publicFunction(item) {
  return {
    file: item.file,
    name: item.name,
    complexity: item.complexity,
    coverage: item.coverage,
    crap: item.crap,
  };
}

export function crapEvidence(functions) {
  return `${JSON.stringify(
    { functions: functions.map(publicFunction) },
    null,
    2,
  )}\n`;
}

export function formatCrapTopValue(worst, above, threshold = CRAP_MAX) {
  return `worst ${worst.toFixed(2)}, ${above} above ${threshold}`;
}

function unknownResult(value, scoreMax, overMax) {
  return {
    status: 'UNKNOWN',
    value,
    floor: crapTopFloorLabel(scoreMax, overMax),
    metrics: null,
  };
}

export function evaluateCrapTop(measurement, options = {}) {
  const scoreMax = options.scoreMax ?? CRAP_MAX_SCORE;
  const overMax = options.overMax ?? CRAP_OVER_30_MAX;
  const threshold = options.threshold ?? CRAP_MAX;
  const floor = crapTopFloorLabel(scoreMax, overMax);
  if (!measurement || !Array.isArray(measurement.functions)) {
    return unknownResult(UNKNOWN_COUNTS, scoreMax, overMax);
  }
  if (!measurement.coveragePresent) {
    return unknownResult(UNKNOWN_COVERAGE, scoreMax, overMax);
  }
  if (measurement.parseErrors?.length) {
    const detail = measurement.parseErrors.slice(0, 5).join('; ');
    return {
      status: 'FAIL',
      value: `CRAP top 10: FAIL. ${detail}`,
      floor,
      metrics: null,
    };
  }
  if (rankProblem(measurement.functions)) {
    return unknownResult(UNKNOWN_COUNTS, scoreMax, overMax);
  }
  const ranked = rankFunctions(measurement.functions);
  if (ranked.length === 0) {
    return unknownResult(UNKNOWN_COUNTS, scoreMax, overMax);
  }
  const worst = ranked[0].crap;
  const above = ranked.filter((item) => item.crap > threshold).length;
  const top10 = ranked.slice(0, 10).map(publicFunction);
  const metrics = {
    functions: ranked.length,
    worst,
    above,
    threshold,
    scoreMax,
    overMax,
    top10,
  };
  const summary = formatCrapTopValue(worst, above, threshold);
  const reasons = [];
  if (worst > scoreMax)
    reasons.push(`worst ${worst.toFixed(2)} is above ${scoreMax}`);
  if (above > overMax) {
    reasons.push(`${above} above ${threshold} is above ${overMax}`);
  }
  if (reasons.length > 0) {
    return {
      status: 'FAIL',
      value: `CRAP top 10: FAIL. ${summary}. ${reasons.join('. ')}`,
      floor,
      metrics,
      ranked,
    };
  }
  return { status: 'PASS', value: summary, floor, metrics, ranked };
}

function loadCoverage(path) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    if (Object.keys(parsed).length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCrapEvidence(result, ranked) {
  const payload = crapEvidence(ranked);
  const evidencePath = process.env.CRAP_EVIDENCE || CRAP_EVIDENCE_PATH;
  mkdirSync(dirname(evidencePath), { recursive: true });
  writeFileSync(evidencePath, payload);
  result.evidenceSha256 = createHash('sha256').update(payload).digest('hex');
  result.evidencePath = evidencePath;
  return result;
}

function isDirectRun() {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
}

if (isDirectRun()) {
  const coveragePath =
    process.env.GATE_COVERAGE_FINAL || 'coverage/coverage-final.json';
  const root = process.env.CRAP_ROOT || process.cwd();
  const coverage = loadCoverage(coveragePath);
  if (!coverage) {
    process.exit(
      finishGate(
        'crap',
        evaluateCrapTop({
          functions: [],
          coveragePresent: false,
          parseErrors: [],
        }),
      ),
    );
  }
  const measured = await measureFunctions(root, coverage);
  const result = evaluateCrapTop({ ...measured, coveragePresent: true });
  if (Array.isArray(result.ranked) && result.ranked.length > 0) {
    writeCrapEvidence(result, result.ranked);
  }
  delete result.ranked;
  process.exit(finishGate('crap', result));
}
