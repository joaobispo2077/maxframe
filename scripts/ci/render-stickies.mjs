import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import { mkdirSync } from 'node:fs';

import { writeChartFiles } from './render-kpi-charts.mjs';
import { readFileSync } from 'node:fs';

function isDirectRun() {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
}

function runNode(script) {
  return spawnSync(process.execPath, [script], {
    env: process.env,
    encoding: 'utf8',
  });
}

if (isDirectRun()) {
  const reportPath =
    process.env.CI_READINESS_REPORT || 'reports/quality/ci-readiness.json';
  const chartDir = process.env.CHART_DIR || 'reports/quality/charts';
  let report = null;
  try {
    report = JSON.parse(readFileSync(reportPath, 'utf8'));
  } catch {
    report = null;
  }
  if (report) {
    mkdirSync(chartDir, { recursive: true });
    try {
      writeChartFiles(report, chartDir);
    } catch (error) {
      console.error(`chart files failed: ${error.message}`);
    }
  }
  const software = runNode('scripts/ci/render-quality-report.mjs');
  const mutation = runNode('scripts/ci/render-mutation-report.mjs');
  if (software.stdout) process.stdout.write(software.stdout);
  if (mutation.stdout) process.stdout.write(mutation.stdout);
  if (software.stderr) process.stderr.write(software.stderr);
  if (mutation.stderr) process.stderr.write(mutation.stderr);
  const softwareCode = software.status ?? 1;
  const mutationCode = mutation.status ?? 1;
  process.exit(softwareCode === 0 && mutationCode === 0 ? 0 : 1);
}
