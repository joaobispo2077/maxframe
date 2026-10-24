import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { sha256File } from './gate-metrics.mjs';
import { COVERAGE_FLOORS, coverageFloorLabel } from './quality-floors.mjs';
import { finishGate } from './write-result.mjs';

const METRICS = ['statements', 'branches', 'functions', 'lines'];

export function evaluateCoverage(totals, floors = COVERAGE_FLOORS) {
  const floor = coverageFloorLabel(floors);
  if (!totals) {
    return {
      status: 'UNKNOWN',
      value: 'Coverage: UNKNOWN. Counts unavailable from this run.',
      floor,
      metrics: null,
    };
  }
  const parts = [];
  const failures = [];
  const metrics = {};
  for (const key of METRICS) {
    const item = totals[key];
    if (!item || typeof item.pct !== 'number' || Number.isNaN(item.pct)) {
      return {
        status: 'UNKNOWN',
        value: `Coverage: UNKNOWN. ${key} percentage is missing.`,
        floor,
        metrics: null,
      };
    }
    metrics[key] = item.pct;
    const counts =
      item.covered != null && item.total != null
        ? ` (${item.covered}/${item.total})`
        : '';
    parts.push(`${key} ${item.pct.toFixed(2)}%${counts}`);
    if (item.pct < floors[key]) {
      failures.push(`${key} ${item.pct.toFixed(2)}% is below ${floors[key]}`);
    }
  }
  const value = parts.join('; ');
  if (failures.length > 0) {
    return {
      status: 'FAIL',
      value: `Coverage: FAIL. ${value}. ${failures.join('; ')}`,
      floor,
      metrics,
      failures,
    };
  }
  return { status: 'PASS', value, floor, metrics };
}

export function totalsFromSummary(summary) {
  const total = summary?.total;
  if (!total || typeof total !== 'object') return null;
  const metric = (key) => {
    const item = total[key];
    if (!item || typeof item.pct !== 'number' || Number.isNaN(item.pct)) {
      return null;
    }
    return {
      pct: item.pct,
      covered: Number.isFinite(item.covered) ? item.covered : null,
      total: Number.isFinite(item.total) ? item.total : null,
    };
  };
  const totals = {};
  for (const key of METRICS) {
    const item = metric(key);
    if (!item) return null;
    totals[key] = item;
  }
  return totals;
}

function isDirectRun() {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
}

if (isDirectRun()) {
  const path =
    process.env.GATE_COVERAGE_SUMMARY || 'coverage/coverage-summary.json';
  let totals = null;
  let evidenceSha256 = null;
  if (existsSync(path)) {
    try {
      totals = totalsFromSummary(JSON.parse(readFileSync(path, 'utf8')));
      evidenceSha256 = sha256File(path);
    } catch {
      totals = null;
    }
  }
  const result = evaluateCoverage(totals);
  if (evidenceSha256) result.evidenceSha256 = evidenceSha256;
  result.evidencePath = existsSync(path) ? path : null;
  process.exit(finishGate('coverage', result));
}
