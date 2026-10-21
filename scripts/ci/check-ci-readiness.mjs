import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { attemptLine, buildQualityRows } from './gate-metrics.mjs';

export const REQUIRED_JOBS = [
  'typecheck',
  'lint',
  'format',
  'unit-tests',
  'e2e-tests',
  'mutation-tests',
  'scheduled-workflow',
];

export const JOB_DISPLAY_NAMES = {
  typecheck: 'Typecheck',
  lint: 'Lint',
  format: 'Format',
  'unit-tests': 'Unit Tests',
  'e2e-tests': 'E2E Tests (Cypress Component)',
  'mutation-tests': 'Mutation Tests (Stryker)',
  'scheduled-workflow': 'Scheduled workflow state',
  'ci-readiness': 'CI readiness',
};

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function formatReceived(result) {
  if (result === undefined || result === null) return 'null';
  return JSON.stringify(result);
}

export function jobResult(needs, job) {
  if (!isObject(needs)) return null;
  const evidence = needs[job];
  if (!isObject(evidence)) return null;
  return typeof evidence.result === 'string' ? evidence.result : null;
}

export function resultFailures(needs) {
  if (!isObject(needs)) {
    return ['mandatory job results must be a JSON object'];
  }
  const failures = [];
  for (const job of REQUIRED_JOBS) {
    const result = jobResult(needs, job);
    if (result !== 'success') {
      failures.push(
        `${job}: expected success, received ${formatReceived(result)}`,
      );
    }
  }
  return failures;
}

export function gateFailures(job, receipt, sha) {
  if (!isObject(receipt)) return [`${job}: missing gate.json`];
  const failures = [];
  if (receipt.schemaVersion !== 1) {
    failures.push(`${job}: gate.json schemaVersion is not 1`);
  }
  if (receipt.job !== job) {
    failures.push(
      `${job}: gate.json job is ${formatReceived(receipt.job ?? null)}`,
    );
  }
  if (receipt.status !== 'PASS') {
    failures.push(
      `${job}: gate.json status is ${formatReceived(receipt.status ?? null)}`,
    );
  }
  if (receipt.result !== 'success') {
    failures.push(
      `${job}: gate.json result is ${formatReceived(receipt.result ?? null)}`,
    );
  }
  if (receipt.exitCode !== 0) {
    failures.push(
      `${job}: gate.json exitCode is ${formatReceived(receipt.exitCode ?? null)}`,
    );
  }
  if (sha && receipt.sha !== sha) {
    failures.push(`${job}: gate.json sha does not match this run`);
  }
  return failures;
}

export function evaluateReadiness({ needs, gates, sha = '' }) {
  const failures = resultFailures(needs);
  if (isObject(needs)) {
    for (const job of REQUIRED_JOBS) {
      failures.push(...gateFailures(job, gates?.[job] ?? null, sha));
    }
  }
  return failures;
}

export function jobUrlsFromList(jobs) {
  const urls = {};
  if (!Array.isArray(jobs)) return urls;
  for (const [id, name] of Object.entries(JOB_DISPLAY_NAMES)) {
    const match = jobs.find((job) => job?.name === name && job.html_url);
    if (match) urls[id] = match.html_url;
  }
  return urls;
}

export function buildReport({ needs, gates, failures, env, jobUrls = {} }) {
  const jobs = {};
  for (const job of REQUIRED_JOBS) {
    const receipt = gates?.[job] ?? null;
    jobs[job] = {
      result: jobResult(needs, job),
      gate: isObject(receipt)
        ? {
            status: receipt.status ?? null,
            result: receipt.result ?? null,
            exitCode: receipt.exitCode ?? null,
            sha: receipt.sha ?? null,
            value: receipt.value ?? null,
            evidenceSha256: receipt.evidenceSha256 ?? null,
          }
        : null,
      accepted: !failures.some((failure) => failure.startsWith(`${job}:`)),
    };
  }
  const server = env.GITHUB_SERVER_URL || 'https://github.com';
  const repository = env.GITHUB_REPOSITORY || '';
  const runId = env.GITHUB_RUN_ID || '';
  const runUrl =
    repository && runId
      ? `${server}/${repository}/actions/runs/${runId}`
      : null;
  const runAttempt = env.GITHUB_RUN_ATTEMPT || null;
  const rows = buildQualityRows({ needs, gates, jobUrls, runUrl });
  const blockUnknown = rows.some(
    (row) => row?.mode === 'BLOCK' && row?.status === 'UNKNOWN',
  );
  const status =
    failures.length > 0 ? 'FAIL' : blockUnknown ? 'UNKNOWN' : 'PASS';
  return {
    schemaVersion: 1,
    gate: 'ci-readiness',
    sha: env.GITHUB_SHA || null,
    runId: runId || null,
    runAttempt,
    runUrl,
    status,
    result: status === 'PASS' ? 'success' : 'failure',
    requiredJobs: REQUIRED_JOBS,
    jobs,
    failures,
    rows,
    attemptLine: attemptLine(runAttempt),
  };
}

function authHeaders(token) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'maxframe-ci-readiness',
  };
}

async function fetchBytes(fetchImpl, url, token, redirect) {
  const response = await fetchImpl(url, {
    redirect: redirect ? 'follow' : 'manual',
    headers: redirect
      ? { 'User-Agent': 'maxframe-ci-readiness' }
      : authHeaders(token),
  });
  if (!redirect && response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location');
    if (!location) throw new Error('artifact redirect missing location');
    return fetchBytes(fetchImpl, location, token, true);
  }
  if (!response.ok) {
    throw new Error(`artifact request failed: ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function defaultUnpack(zipPath, destDir) {
  execFileSync('unzip', ['-o', zipPath, '-d', destDir], { stdio: 'ignore' });
}

function readGateFile(dir) {
  const direct = join(dir, 'gate.json');
  try {
    return JSON.parse(readFileSync(direct, 'utf8'));
  } catch {
    return null;
  }
}

export async function collectGateReceipts({
  fetchImpl = globalThis.fetch,
  repo,
  token,
  runId,
  destDir,
  unpack = defaultUnpack,
  jobs = REQUIRED_JOBS,
}) {
  if (!repo || !token || !runId) {
    throw new Error(
      'repository, token, and run id are required to fetch gate.json',
    );
  }
  const listUrl = `https://api.github.com/repos/${repo}/actions/runs/${runId}/artifacts?per_page=100`;
  const listed = await fetchImpl(listUrl, { headers: authHeaders(token) });
  if (!listed.ok) {
    throw new Error(`gate artifact list failed: ${listed.status}`);
  }
  const body = await listed.json();
  const artifacts = Array.isArray(body.artifacts) ? body.artifacts : [];
  const gates = {};
  for (const job of jobs) {
    const name = `gate-${job}`;
    const artifact = artifacts.find(
      (item) => item?.name === name && !item.expired,
    );
    if (!artifact) {
      gates[job] = null;
      continue;
    }
    const zipUrl = `https://api.github.com/repos/${repo}/actions/artifacts/${artifact.id}/zip`;
    const bytes = await fetchBytes(fetchImpl, zipUrl, token, false);
    const dir = join(destDir, name);
    mkdirSync(dir, { recursive: true });
    const zipPath = join(dir, 'gate.zip');
    writeFileSync(zipPath, bytes);
    unpack(zipPath, dir);
    gates[job] = readGateFile(dir);
  }
  return gates;
}

export function readGatesFromDir(dir, jobs = REQUIRED_JOBS) {
  const gates = {};
  for (const job of jobs) {
    const path = join(dir, `gate-${job}`, 'gate.json');
    try {
      gates[job] = JSON.parse(readFileSync(path, 'utf8'));
    } catch {
      gates[job] = null;
    }
  }
  return gates;
}

export async function fetchJobUrls({
  fetchImpl = globalThis.fetch,
  repo,
  token,
  runId,
}) {
  const url = `https://api.github.com/repos/${repo}/actions/runs/${runId}/jobs?per_page=100`;
  const response = await fetchImpl(url, { headers: authHeaders(token) });
  if (!response.ok) {
    throw new Error(`job list failed: ${response.status}`);
  }
  const body = await response.json();
  return jobUrlsFromList(body.jobs);
}

function writeOutputs(env, report) {
  if (!env.GITHUB_OUTPUT) return;
  writeFileSync(
    env.GITHUB_OUTPUT,
    `status=${report.status}\nresult=${report.result}\n`,
    { flag: 'a' },
  );
}

export async function main(env = process.env) {
  let needs = null;
  let parseFailures = [];
  try {
    needs = JSON.parse(env.CI_NEEDS_JSON ?? '');
  } catch (error) {
    parseFailures = [`invalid CI_NEEDS_JSON: ${error.message}`];
  }

  let gates = {};
  let fetchFailures = [];
  if (parseFailures.length === 0 && env.FETCH_GATE_ARTIFACTS === '1') {
    try {
      gates = await collectGateReceipts({
        repo: env.GITHUB_REPOSITORY,
        token: env.GH_TOKEN || env.GITHUB_TOKEN,
        runId: env.GITHUB_RUN_ID,
        destDir: env.GATE_INCOMING_DIR || 'reports/quality/incoming-gates',
      });
    } catch (error) {
      fetchFailures = [`gate artifact download failed: ${error.message}`];
    }
  } else if (env.GATE_INCOMING_DIR) {
    gates = readGatesFromDir(env.GATE_INCOMING_DIR);
  }

  const failures = [
    ...parseFailures,
    ...fetchFailures,
    ...(parseFailures.length === 0 && fetchFailures.length === 0
      ? evaluateReadiness({
          needs,
          gates,
          sha: env.GITHUB_SHA || '',
        })
      : []),
  ];
  let jobUrls = {};
  if (
    env.GITHUB_REPOSITORY &&
    env.GITHUB_RUN_ID &&
    (env.GH_TOKEN || env.GITHUB_TOKEN)
  ) {
    try {
      jobUrls = await fetchJobUrls({
        repo: env.GITHUB_REPOSITORY,
        token: env.GH_TOKEN || env.GITHUB_TOKEN,
        runId: env.GITHUB_RUN_ID,
      });
    } catch (error) {
      console.error(`job url lookup failed: ${error.message}`);
    }
  }
  const report = buildReport({ needs, gates, failures, env, jobUrls });
  const out = env.CI_READINESS_REPORT || 'reports/quality/ci-readiness.json';
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  writeGateReceiptFile(report, env);
  writeOutputs(env, report);
  if (report.status !== 'PASS') {
    console.error(`CI readiness: ${report.status}`);
    for (const failure of failures) console.error(`  ${failure}`);
    return 1;
  }
  console.log('CI readiness: PASS (all mandatory jobs succeeded)');
  return 0;
}

function writeGateReceiptFile(report, env) {
  const receipt = {
    schemaVersion: 1,
    job: 'ci-readiness',
    gate: 'ci-readiness',
    sha: report.sha,
    runId: report.runId,
    runAttempt: report.runAttempt,
    status: report.status,
    result: report.result,
    exitCode: report.result === 'success' ? 0 : 1,
  };
  const root = env.GATE_ROOT || 'reports/quality/gates';
  const path = join(root, 'ci-readiness', 'gate.json');
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(receipt, null, 2)}\n`);
}

function isDirectRun() {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
}

if (isDirectRun()) {
  main().then(
    (code) => process.exit(code),
    (error) => {
      console.error(`CI readiness: FAIL\n  ${error.message}`);
      process.exit(1);
    },
  );
}
