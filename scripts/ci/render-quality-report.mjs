import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

import { REQUIRED_JOBS } from './check-ci-readiness.mjs';
import { BLOCK_GATES, INFO_GATES, sha256Text } from './gate-metrics.mjs';

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function blockRowIsUnknown(report) {
  if (!Array.isArray(report.rows)) return false;
  return report.rows.some(
    (row) => row?.mode === 'BLOCK' && row?.status === 'UNKNOWN',
  );
}

export function displayOverall(report) {
  if (!isObject(report)) return 'UNKNOWN';
  if (report.status === 'FAIL') return 'FAIL';
  if (blockRowIsUnknown(report)) return 'UNKNOWN';
  if (report.status !== 'PASS') return 'UNKNOWN';
  if (!passIsComplete(report)) return 'FAIL';
  return 'PASS';
}

export function qualityReportExitCode(overall) {
  return overall === 'PASS' ? 0 : 1;
}

function passIsComplete(report) {
  if (!Array.isArray(report.requiredJobs) || !Array.isArray(report.rows))
    return false;
  if (!isObject(report.jobs)) return false;
  for (const job of REQUIRED_JOBS) {
    if (!report.requiredJobs.includes(job)) return false;
    const entry = report.jobs[job];
    if (!isObject(entry) || entry.result !== 'success') return false;
    if (!isObject(entry.gate) || entry.gate.status !== 'PASS') return false;
  }
  for (const spec of BLOCK_GATES) {
    const row = report.rows.find(
      (item) => item?.job === spec.job && item?.mode === 'BLOCK',
    );
    if (!row || row.status !== 'PASS' || !row.value) return false;
  }
  for (const spec of INFO_GATES) {
    const row = report.rows.find((item) => item?.job === spec.job);
    if (!row || row.mode !== 'INFO' || !row.status || !row.value) return false;
    if (row.status === 'PASS') return false;
  }
  return true;
}

function overallLine(overall) {
  if (overall === 'UNKNOWN') return '🔴 **Overall: UNKNOWN**';
  if (overall === 'FAIL') return '**Overall: FAIL**';
  return '**Overall: PASS**';
}

function cell(value) {
  return String(value ?? 'unavailable')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ');
}

function runCell(row) {
  if (!row?.runUrl) return 'unavailable';
  return `[run](${row.runUrl})`;
}

export function unknownQualityMarkdown(reason) {
  return [
    '## maxframe quality',
    '',
    overallLine('UNKNOWN'),
    '',
    reason,
    '',
    'This is not a pass.',
    '',
    'Commit: unavailable',
    'Run: unavailable',
    'ci-readiness.json SHA-256: unavailable',
    '',
  ].join('\n');
}

export function renderQualityMarkdown(report, { artifactSha256 = null } = {}) {
  const overall = displayOverall(report);
  if (!isObject(report)) {
    return unknownQualityMarkdown('ci-readiness.json is unreadable.');
  }
  const lines = ['## maxframe quality', '', overallLine(overall), ''];
  const hasRows = Array.isArray(report.rows) && report.rows.length > 0;
  if (
    overall === 'UNKNOWN' &&
    !hasRows &&
    report.status !== 'FAIL' &&
    report.status !== 'PASS'
  ) {
    lines.push(
      'ci-readiness.json is unreadable.',
      '',
      'This is not a pass.',
      '',
    );
  } else if (overall === 'UNKNOWN') {
    lines.push('This is not a pass.', '');
  }
  if (Array.isArray(report.rows) && report.rows.length > 0) {
    lines.push(
      '| Gate | Mode | Status | Value | Floor | Run |',
      '|---|---|---|---|---|---|',
    );
    for (const row of report.rows) {
      lines.push(
        `| ${cell(row?.gate)} | ${cell(row?.mode)} | ${cell(row?.status)} | ${cell(row?.value)} | ${cell(row?.floor)} | ${runCell(row)} |`,
      );
    }
    lines.push('');
  }
  const evidence = (report.rows ?? []).filter((row) => row?.evidenceSha256);
  if (evidence.length > 0) {
    lines.push('Evidence SHA-256:');
    for (const row of evidence) {
      lines.push(`- ${row.gate}: \`${row.evidenceSha256}\``);
    }
    lines.push('');
  }
  if (Array.isArray(report.failures) && report.failures.length > 0) {
    lines.push('Readiness failures:');
    for (const failure of report.failures) lines.push(`- ${failure}`);
    lines.push('');
  }
  if (typeof report.attemptLine === 'string' && report.attemptLine) {
    lines.push(report.attemptLine, '');
  }
  const sha = report.sha || 'unavailable';
  const run = report.runUrl ? `[run](${report.runUrl})` : 'unavailable';
  const digest = artifactSha256 || 'unavailable';
  lines.push(
    `Commit: \`${sha}\``,
    `Run: ${run}`,
    `ci-readiness.json SHA-256: \`${digest}\``,
    '',
  );
  return `${lines.join('\n')}`;
}

export function renderQualityReportText(text) {
  let report;
  try {
    report = JSON.parse(text);
  } catch {
    return {
      overall: 'UNKNOWN',
      markdown: unknownQualityMarkdown('ci-readiness.json is unreadable.'),
    };
  }
  const markdown = renderQualityMarkdown(report, {
    artifactSha256: sha256Text(text),
  });
  return { overall: displayOverall(report), markdown };
}

export function renderQualityReportFile(path) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return {
      overall: 'UNKNOWN',
      markdown: unknownQualityMarkdown('ci-readiness.json is missing.'),
    };
  }
  return renderQualityReportText(text);
}

function isDirectRun() {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
}

if (isDirectRun()) {
  const reportPath =
    process.env.CI_READINESS_REPORT || 'reports/quality/ci-readiness.json';
  const outPath =
    process.env.QUALITY_REPORT || 'reports/quality/maxframe-quality.md';
  const { markdown, overall } = renderQualityReportFile(reportPath);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, markdown.endsWith('\n') ? markdown : `${markdown}\n`);
  process.stdout.write(markdown.endsWith('\n') ? markdown : `${markdown}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n${markdown}\n`);
  }
  console.log(`Wrote ${outPath} (overall ${overall})`);
  process.exit(qualityReportExitCode(overall));
}
