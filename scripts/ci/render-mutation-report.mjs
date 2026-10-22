import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

import { mutationFloorLabel } from './quality-floors.mjs';
import { selectNamedArtifact } from './check-ci-readiness.mjs';

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function mutationRow(report) {
  if (!isObject(report) || !Array.isArray(report.rows)) return null;
  return report.rows.find((row) => row?.job === 'mutation-tests') ?? null;
}

export function mutationOverall(report) {
  const row = mutationRow(report);
  if (!row || !row.status) return 'UNKNOWN';
  if (
    row.status === 'PASS' ||
    row.status === 'FAIL' ||
    row.status === 'UNKNOWN'
  ) {
    return row.status;
  }
  return 'UNKNOWN';
}

function count(metrics, key) {
  const value = metrics?.[key];
  return Number.isFinite(value) ? String(value) : 'unavailable';
}

export function renderMutationMarkdown(report, { htmlReportUrl = null } = {}) {
  const overall = mutationOverall(report);
  const row = mutationRow(report);
  const metrics = isObject(report) ? report.mutation : null;
  const scope = isObject(report) ? report.mutationScope : null;
  const survivors = Array.isArray(report?.survivors) ? report.survivors : [];
  const lines = [
    '## Mutation tests',
    '',
    `**Overall: ${overall}**`,
    '',
    '- **Profile:** light, Stryker incremental on changed files',
    `- **Scope:** ${scope?.scopeLabel || 'unavailable'}`,
    `- **Tested this run:** ${count(metrics, 'tested')}`,
    `- **Cached:** ${count(metrics, 'cached')}`,
    `- **Floor:** ${row?.floor || mutationFloorLabel()}`,
    `- **Score:** ${metrics?.detectedScore == null ? 'unavailable' : `${Number(metrics.detectedScore).toFixed(2)}%`}`,
    `- **Killed:** ${count(metrics, 'killed')}`,
    `- **Survived:** ${count(metrics, 'survived')}`,
    `- **Timeout:** ${count(metrics, 'timeout')}`,
    `- **No coverage:** ${count(metrics, 'noCoverage')}`,
    '',
    '### Survivors per file',
    '',
  ];
  if (survivors.length === 0) {
    lines.push('No survived mutants were listed for this run.', '');
  } else {
    lines.push('| File | Survived |', '|---|---:|');
    for (const item of survivors) {
      lines.push(`| ${item.file} | ${item.survived} |`);
    }
    lines.push('');
  }
  const link = htmlReportUrl
    ? `[HTML report artifact](${htmlReportUrl})`
    : 'unavailable';
  lines.push(
    `HTML report artifact: ${link}`,
    '',
    `<!-- chart-overall:${overall} -->`,
    '',
  );
  if (overall !== 'PASS') {
    lines.push('This is not a pass.', '');
  }
  return lines.join('\n');
}

export function mutationReportExitCode(overall) {
  return overall === 'PASS' ? 0 : 1;
}

export async function lookupHtmlReportUrl({
  fetchImpl = globalThis.fetch,
  repo,
  token,
  runId,
  attempt,
}) {
  if (!repo || !token || !runId) return null;
  const name = attempt
    ? `mutation-reports-attempt-${attempt}`
    : 'mutation-reports';
  const artifacts = [];
  for (let page = 1; page <= 10; page += 1) {
    const url = `https://api.github.com/repos/${repo}/actions/runs/${runId}/artifacts?per_page=100&page=${page}`;
    const response = await fetchImpl(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'maxframe-mutation-report',
      },
    });
    if (!response.ok) return null;
    const body = await response.json();
    const batch = Array.isArray(body.artifacts) ? body.artifacts : [];
    artifacts.push(...batch);
    if (batch.length < 100) break;
  }
  const artifact = selectNamedArtifact(artifacts, name);
  if (!artifact?.id) return null;
  return `https://github.com/${repo}/actions/runs/${runId}/artifacts/${artifact.id}`;
}

function isDirectRun() {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
}

if (isDirectRun()) {
  const reportPath =
    process.env.CI_READINESS_REPORT || 'reports/quality/ci-readiness.json';
  const outPath =
    process.env.MUTATION_REPORT || 'reports/quality/mutation-report.md';
  let report = null;
  try {
    report = JSON.parse(readFileSync(reportPath, 'utf8'));
  } catch {
    report = null;
  }
  const write = async () => {
    let htmlReportUrl = process.env.MUTATION_HTML_URL || null;
    if (
      !htmlReportUrl &&
      process.env.GITHUB_REPOSITORY &&
      process.env.GITHUB_RUN_ID &&
      (process.env.GH_TOKEN || process.env.GITHUB_TOKEN)
    ) {
      htmlReportUrl = await lookupHtmlReportUrl({
        repo: process.env.GITHUB_REPOSITORY,
        token: process.env.GH_TOKEN || process.env.GITHUB_TOKEN,
        runId: process.env.GITHUB_RUN_ID,
        attempt: process.env.GITHUB_RUN_ATTEMPT || '',
      });
    }
    const markdown = renderMutationMarkdown(report, { htmlReportUrl });
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(
      outPath,
      markdown.endsWith('\n') ? markdown : `${markdown}\n`,
    );
    process.stdout.write(markdown.endsWith('\n') ? markdown : `${markdown}\n`);
    const overall = mutationOverall(report);
    console.log(`Wrote ${outPath} (overall ${overall})`);
    process.exit(mutationReportExitCode(overall));
  };
  write().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
