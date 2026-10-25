import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

import { REQUIRED_JOBS } from './check-ci-readiness.mjs';
import { withQualityGateHeader } from './comment-header.mjs';
import {
  BLOCK_GATES,
  INFO_GATES,
  sha256Text,
  unwiredGateRows,
} from './gate-metrics.mjs';
import {
  CHART_END,
  CHART_START,
  buildChartMarkdown,
} from './render-kpi-charts.mjs';

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
    if (!isObject(entry.gate)) return false;
    if (job === 'mutation-tests' && entry.gate.status === 'INFO') {
      const unchanged = report.mutationScope?.mutableSourceChanged === false;
      const text = String(entry.gate.value || '').includes(
        'no mutable source changed',
      );
      if (!unchanged || !text) return false;
      continue;
    }
    if (entry.gate.status !== 'PASS') return false;
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
  const mutation = report.rows.find((item) => item?.job === 'mutation-tests');
  if (
    mutation?.mode === 'INFO' &&
    mutation.status === 'INFO' &&
    String(mutation.value || '').includes('no mutable source changed') &&
    report.mutationScope?.mutableSourceChanged === false
  ) {
    return true;
  }
  if (
    !mutation ||
    mutation.mode !== 'BLOCK' ||
    mutation.status !== 'PASS' ||
    !mutation.value
  ) {
    return false;
  }
  return true;
}

function overallLine(overall) {
  if (overall === 'UNKNOWN') return '🔴 **Overall: UNKNOWN**';
  if (overall === 'FAIL') return '**Overall: FAIL**';
  return '**Overall: PASS**';
}

function plainGate(name) {
  const text = String(name || '').trim();
  if (!/^[A-Za-z0-9 .()/_+-]+$/.test(text) || text.length > 80) return null;
  return text;
}

export function presentUnwired(report) {
  const source = Array.isArray(report?.unwired)
    ? report.unwired
    : unwiredGateRows();
  const rows = [];
  for (const row of source) {
    const gate = plainGate(row?.gate);
    if (!gate) continue;
    rows.push({
      gate,
      job: plainGate(row?.job) || gate,
      mode: 'UNWIRED',
      status: 'NOT_WIRED',
      value: `${gate}: Not wired yet. Does not change Overall.`,
      floor: 'none',
      runUrl: null,
      artifactUrl: null,
      evidenceSha256: null,
    });
  }
  return rows;
}

const MISSING_EVIDENCE =
  /Unavailable: no evidence from this run|Skipped, no evidence from this run|Cancelled, no evidence from this run|No gate\.json from this run|Counts unavailable/i;

export function evidenceClass(row) {
  if (!row || row.mode === 'UNWIRED' || row.status === 'NOT_WIRED') return null;
  const value = String(row.value ?? '').trim();
  const hasHash =
    typeof row.evidenceSha256 === 'string' &&
    /^[a-f0-9]{64}$/i.test(row.evidenceSha256);
  const missing = value === '' || MISSING_EVIDENCE.test(value);
  if (missing) return 'unavailable';
  if (hasHash) return 'measured';
  return 'partial';
}

export function evidenceCompletenessLine(rows) {
  const counts = { measured: 0, partial: 0, unavailable: 0 };
  for (const row of rows ?? []) {
    const kind = evidenceClass(row);
    if (kind) counts[kind] += 1;
  }
  return `Evidence completeness: ${counts.measured} measured, ${counts.partial} partial, ${counts.unavailable} unavailable.`;
}

export function gatesWiredLine(rows, unwired) {
  const wired = (rows ?? []).filter(
    (row) => row?.mode !== 'UNWIRED' && row?.status !== 'NOT_WIRED',
  ).length;
  return `${wired} of ${wired + unwired.length} gates wired.`;
}

function failedGateNames(report) {
  const fromRows = (report?.rows ?? [])
    .filter((row) => row?.mode !== 'UNWIRED' && row?.status === 'FAIL')
    .map((row) => plainGate(row.gate))
    .filter(Boolean);
  if (fromRows.length > 0) return fromRows;
  const names = [];
  for (const failure of report?.failures ?? []) {
    const job = String(failure).split(':')[0];
    const spec = BLOCK_GATES.find((gate) => gate.job === job);
    const gate = spec?.gate || (job === 'mutation-tests' ? 'Mutation' : null);
    if (gate && !names.includes(gate)) names.push(gate);
  }
  return names;
}

export function summaryLine(overall, report, unwired) {
  const pending = unwired.map((row) => row.gate);
  const pendingText = pending.length > 0 ? pending.join(', ') : 'none';
  if (overall === 'PASS') {
    return `All wired gates passed. ${pending.length} gates not wired yet.`;
  }
  if (overall === 'FAIL') {
    const failed = failedGateNames(report);
    const failedText = failed.length > 0 ? failed.join(', ') : 'CI readiness';
    return `Failed: ${failedText}. Not wired yet: ${pendingText}.`;
  }
  return `This is not a pass. Not wired yet: ${pendingText}.`;
}

function safeActionsUrl(url) {
  if (typeof url !== 'string') return null;
  if (
    !/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/actions\/runs\/[1-9]\d*(\/(artifacts|jobs?)\/[1-9]\d*)?$/.test(
      url,
    )
  ) {
    return null;
  }
  return url;
}

function safePullUrl(url) {
  if (typeof url !== 'string') return null;
  if (
    !/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/pull\/[1-9]\d*$/.test(
      url,
    )
  ) {
    return null;
  }
  return url;
}

export function evidenceLink(row) {
  const artifact = safeActionsUrl(row?.artifactUrl);
  if (artifact && /\/artifacts\/[1-9]\d*$/.test(artifact)) {
    return `[artifact](${artifact})`;
  }
  const job = safeActionsUrl(row?.runUrl);
  if (job && /\/jobs?\/[1-9]\d*$/.test(job)) return `[job](${job})`;
  if (job) return `[run](${job})`;
  return 'unavailable';
}

function identityLines(report) {
  const pr = isObject(report?.pullRequest) ? report.pullRequest : {};
  const url = safePullUrl(pr.url);
  const number = /^[1-9]\d*$/.test(String(pr.number || '')) ? pr.number : null;
  const head = plainGate(pr.headSha);
  const baseSha = plainGate(pr.baseSha);
  const baseRef = plainGate(pr.baseRef);
  const tested = plainGate(report?.sha);
  let base = 'PR base: unavailable';
  if (baseSha && baseRef) base = `PR base: \`${baseSha}\` (${baseRef})`;
  else if (baseSha) base = `PR base: \`${baseSha}\``;
  else if (baseRef) base = `PR base: ${baseRef}`;
  return [
    number && url ? `PR: [#${number}](${url})` : 'PR: unavailable',
    head ? `PR head: \`${head}\`` : 'PR head: unavailable',
    base,
    tested ? `Tested revision: \`${tested}\`` : 'Tested revision: unavailable',
  ];
}

function countCell(value) {
  return Number.isFinite(value) ? String(value) : 'unavailable';
}

function executedTestLines(rows) {
  const suites = [
    { job: 'unit-tests', suite: 'Unit (Vitest)' },
    { job: 'e2e-tests', suite: 'E2E (Cypress)' },
  ];
  const lines = [
    '### Executed test evidence',
    '',
    "Passed, failed, and skipped counts come from this run's Vitest and Cypress receipts.",
    '',
    '| Suite | Passed | Failed | Skipped | Result | Evidence |',
    '|---|---|---|---|---|---|',
  ];
  for (const spec of suites) {
    const row = (rows ?? []).find((item) => item?.job === spec.job);
    const metrics = row?.metrics;
    const status = row?.status || 'UNKNOWN';
    lines.push(
      `| ${spec.suite} | ${countCell(metrics?.passed)} | ${countCell(metrics?.failed)} | ${countCell(metrics?.skipped)} | ${cell(status)} | ${cell(evidenceLink(row))} |`,
    );
  }
  return lines;
}

function cell(value) {
  return String(value ?? 'unavailable')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ');
}

function coverageCell(value) {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${value.toFixed(2)}%`
    : 'unavailable';
}

function crapCell(value) {
  return typeof value === 'number' && Number.isFinite(value)
    ? value.toFixed(2)
    : 'unavailable';
}

export function crapTopSection(rows) {
  const row = (rows ?? []).find((item) => item?.job === 'crap');
  const top = row?.metrics?.top10;
  if (!Array.isArray(top) || top.length === 0) return [];
  const lines = [
    '<details>',
    '<summary>CRAP top 10</summary>',
    '',
    '| Function | Complexity | Coverage | CRAP |',
    '| --- | --- | --- | --- |',
  ];
  for (const item of top.slice(0, 10)) {
    lines.push(
      `| ${cell(`${item?.file}:${item?.name}`)} | ${cell(item?.complexity)} | ${cell(coverageCell(item?.coverage))} | ${cell(crapCell(item?.crap))} |`,
    );
  }
  lines.push('', '</details>', '');
  return lines;
}

function sectionHeading(unwired) {
  return [
    '### Not wired yet',
    '',
    ...unwired.map((row) => `- ${row.value}`),
    '',
  ];
}

export function unknownQualityMarkdown(reason) {
  const unwired = presentUnwired(null);
  const markdown = [
    '## Software metrics',
    '',
    'Gates wired: unavailable.',
    '',
    overallLine('UNKNOWN'),
    '',
    summaryLine('UNKNOWN', null, unwired),
    '',
    reason,
    '',
    'PR: unavailable',
    'PR head: unavailable',
    'PR base: unavailable',
    'Tested revision: unavailable',
    '',
    'Evidence completeness: unavailable.',
    '',
    ...sectionHeading(unwired),
    '### Executed test evidence',
    '',
    'Executed test counts are unavailable for this run.',
    '',
    CHART_START,
    '## KPI charts',
    '',
    '**Overall: UNKNOWN**',
    '',
    'No measurements were available for this run.',
    '',
    '### Mutation',
    '',
    'Mutation is not part of this chart set. See the Mutation tests sticky (`mutation-report`).',
    '',
    '<!-- chart-overall:UNKNOWN -->',
    CHART_END,
    '',
    'Commit: unavailable',
    'Run: unavailable',
    'ci-readiness.json SHA-256: unavailable',
    '',
  ].join('\n');
  return withQualityGateHeader(markdown);
}

export function renderQualityMarkdown(report, { artifactSha256 = null } = {}) {
  const overall = displayOverall(report);
  if (!isObject(report)) {
    return unknownQualityMarkdown('ci-readiness.json is unreadable.');
  }
  const rows = Array.isArray(report.rows) ? report.rows : [];
  const unwired = presentUnwired(report);
  const lines = [
    '## Software metrics',
    '',
    gatesWiredLine(rows, unwired),
    '',
    overallLine(overall),
    '',
    summaryLine(overall, report, unwired),
    '',
    ...identityLines(report),
    '',
  ];
  if (typeof report.attemptLine === 'string' && report.attemptLine) {
    lines.push(report.attemptLine, '');
  }
  lines.push(evidenceCompletenessLine(rows), '');
  if (
    overall === 'UNKNOWN' &&
    rows.length === 0 &&
    report.status !== 'FAIL' &&
    report.status !== 'PASS'
  ) {
    lines.push('ci-readiness.json is unreadable.', '');
  }
  if (rows.length > 0) {
    lines.push(
      '| Gate | Value | Floor | Result | Evidence |',
      '|---|---|---|---|---|',
    );
    for (const row of rows) {
      lines.push(
        `| ${cell(row?.gate)} | ${cell(row?.value)} | ${cell(row?.floor)} | ${cell(row?.status)} | ${cell(evidenceLink(row))} |`,
      );
    }
    lines.push('');
  }
  lines.push(...crapTopSection(rows));
  lines.push(
    CHART_START,
    buildChartMarkdown(report, overall).trimEnd(),
    CHART_END,
    '',
    ...sectionHeading(unwired),
    ...executedTestLines(rows),
    '',
  );
  const evidence = rows.filter(
    (row) => row?.evidenceSha256 || row?.artifactUrl,
  );
  if (evidence.length > 0) {
    lines.push('Evidence SHA-256:');
    for (const row of evidence) {
      const link = evidenceLink(row);
      const sha = row.evidenceSha256
        ? `\`${row.evidenceSha256}\``
        : 'no SHA-256';
      const prefix = link === 'unavailable' ? sha : `${link} ${sha}`;
      lines.push(`- ${cell(row.gate)}: ${prefix}`);
    }
    lines.push('');
  }
  if (Array.isArray(report.failures) && report.failures.length > 0) {
    lines.push('Readiness failures:');
    for (const failure of report.failures) lines.push(`- ${failure}`);
    lines.push('');
  }
  const sha = report.sha || 'unavailable';
  const run = safeActionsUrl(report.runUrl)
    ? `[run](${report.runUrl})`
    : 'unavailable';
  const digest = artifactSha256 || 'unavailable';
  lines.push(`Commit: \`${sha}\``);
  if (report.headSha) lines.push(`Head: \`${report.headSha}\``);
  lines.push(`Run: ${run}`, `ci-readiness.json SHA-256: \`${digest}\``, '');
  return withQualityGateHeader(lines.join('\n'));
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
    process.env.QUALITY_REPORT || 'reports/quality/software-metrics.md';
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
