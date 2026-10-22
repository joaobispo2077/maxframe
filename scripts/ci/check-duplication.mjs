import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { sha256File } from './gate-metrics.mjs';
import { DUPLICATION_CEILING } from './quality-floors.mjs';
import { finishGate } from './write-result.mjs';

export function duplicationPercentage(report) {
  const total = report?.statistics?.total;
  const raw = total?.percentage;
  if (typeof raw !== 'number' || Number.isNaN(raw)) return null;
  return raw;
}

export function evaluateDuplication(report, ceiling = DUPLICATION_CEILING) {
  const floor = `<= ${ceiling}%`;
  const percent = duplicationPercentage(report);
  if (percent == null) {
    return {
      status: 'UNKNOWN',
      value: 'Duplication: UNKNOWN. Counts unavailable from this run.',
      floor,
      metrics: null,
    };
  }
  const total = report.statistics.total;
  const metrics = {
    percent,
    duplicatedLines: total.duplicatedLines ?? null,
    lines: total.lines ?? null,
    clones: total.clones ?? null,
  };
  const counts =
    metrics.duplicatedLines != null && metrics.lines != null
      ? ` (${metrics.duplicatedLines}/${metrics.lines} lines)`
      : '';
  const value = `${percent.toFixed(2)}% duplicated${counts}`;
  if (percent > ceiling) {
    return {
      status: 'FAIL',
      value: `Duplication: FAIL. ${value} is above ${ceiling}%`,
      floor,
      metrics,
    };
  }
  return { status: 'PASS', value, floor, metrics };
}

function jscpdBin() {
  return join(process.cwd(), 'node_modules', '.bin', 'jscpd');
}

export function runJscpd() {
  const bin = jscpdBin();
  if (!existsSync(bin)) {
    return { ok: false, error: 'jscpd is not installed' };
  }
  const outDir = 'reports/quality/jscpd';
  const result = spawnSync(
    bin,
    [
      'src',
      'packages/main/src',
      'packages/renderer/src',
      'packages/preload/src',
      '--config',
      '.jscpd.json',
      '--reporters',
      'json',
      '--output',
      outDir,
      '--threshold',
      '100',
      '--silent',
    ],
    { encoding: 'utf8' },
  );
  const reportPath = join(outDir, 'jscpd-report.json');
  if (!existsSync(reportPath)) {
    return {
      ok: false,
      error: result.stderr || result.stdout || 'jscpd report is missing',
    };
  }
  return { ok: true, reportPath };
}

function isDirectRun() {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
}

if (isDirectRun()) {
  const run = runJscpd();
  if (!run.ok) {
    process.exit(
      finishGate('duplication', {
        status: 'UNKNOWN',
        value: `Duplication: UNKNOWN. ${run.error}`,
        floor: `<= ${DUPLICATION_CEILING}%`,
        metrics: null,
      }),
    );
  }
  let report = null;
  try {
    report = JSON.parse(readFileSync(run.reportPath, 'utf8'));
  } catch (error) {
    process.exit(
      finishGate('duplication', {
        status: 'UNKNOWN',
        value: `Duplication: UNKNOWN. ${error.message}`,
        floor: `<= ${DUPLICATION_CEILING}%`,
        metrics: null,
      }),
    );
  }
  const result = evaluateDuplication(report);
  result.evidenceSha256 = sha256File(run.reportPath);
  result.evidencePath = run.reportPath;
  process.exit(finishGate('duplication', result));
}
