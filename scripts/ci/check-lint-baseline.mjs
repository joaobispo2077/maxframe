import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import {
  formatEslintMessages,
  formatLintValue,
  lintBaselineFailures,
  lintFloorLabel,
  readEslintCounts,
} from './gate-metrics.mjs';

export function checkLintBaseline(report) {
  const counts = readEslintCounts(report);
  return { counts, failures: lintBaselineFailures(counts) };
}

function isDirectRun() {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
}

if (isDirectRun()) {
  const path =
    process.argv[2] ||
    process.env.GATE_ESLINT_JSON ||
    'reports/quality/eslint.json';
  let report;
  try {
    report = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    console.error(
      `lint baseline: eslint JSON is missing or unreadable (${error.message})`,
    );
    process.exit(1);
  }
  const { counts, failures } = checkLintBaseline(report);
  for (const line of formatEslintMessages(report)) console.log(line);
  if (failures.length > 0) {
    for (const failure of failures) console.error(failure);
    process.exit(1);
  }
  console.log(
    `lint baseline: ${formatLintValue(counts)} vs ${lintFloorLabel()}`,
  );
}
