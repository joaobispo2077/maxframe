import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  attemptLine,
  buildQualityRows,
  unwiredGateRows,
} from './gate-metrics.mjs';

export const REQUIRED_JOBS = [
  'typecheck',
  'lint',
  'format',
  'unit-tests',
  'e2e-tests',
  'coverage',
  'complexity',
  'duplication',
  'deadcode',
  'architecture',
  'audit',
  'find-dupes',
  'electron-security',
  'mutation-tests',
  'scheduled-workflow',
];

/**
 * The only `ci-readiness` job `if` that still runs when the workflow is
 * cancelled. `always()` is true in that case. `always() && !cancelled()`
 * and `success() || failure()` are not: GitHub skips the job, and a skipped
 * required check counts as a pass.
 */
export const CI_READINESS_IF = 'always()';

/**
 * Jobs in `needs` that may be `skipped` without failing readiness.
 * Required jobs are never included: this workflow has no path filters and
 * no branch filters on them. `cancelled` is never waived. The set is empty.
 * A future non-required path filter must be added here and named in
 * docs/maxframe-quality-gates.md before a skip can pass.
 */
export const INTENTIONAL_SKIP_JOBS = new Set();

export function readinessIfSkipsOnCancellation(expression) {
  return String(expression ?? '').trim() !== CI_READINESS_IF;
}

export const JOB_DISPLAY_NAMES = {
  typecheck: 'Typecheck',
  lint: 'Lint',
  format: 'Format',
  'unit-tests': 'Unit Tests',
  'e2e-tests': 'E2E Tests (Cypress Component)',
  coverage: 'Coverage',
  complexity: 'CRAP / complexity',
  duplication: 'Duplication',
  deadcode: 'Dead code',
  architecture: 'Architecture',
  audit: 'Dependency audit',
  'find-dupes': 'Dependency tree',
  'electron-security': 'Electron security',
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

function needsJobIds(needs) {
  const extras = Object.keys(needs)
    .filter((job) => !REQUIRED_JOBS.includes(job))
    .sort();
  return [...REQUIRED_JOBS, ...extras];
}

/**
 * A `skipped` result is by design only for a non-required job listed in
 * `intentionalSkips`. Required jobs and every `cancelled` result stay red.
 */
export function skipIsByDesign(
  job,
  result,
  intentionalSkips = INTENTIONAL_SKIP_JOBS,
) {
  return (
    result === 'skipped' &&
    !REQUIRED_JOBS.includes(job) &&
    intentionalSkips.has(job)
  );
}

export function resultFailures(
  needs,
  gates = null,
  intentionalSkips = INTENTIONAL_SKIP_JOBS,
) {
  if (!isObject(needs)) {
    return ['mandatory job results must be a JSON object'];
  }
  const failures = [];
  for (const job of needsJobIds(needs)) {
    const result = jobResult(needs, job);
    if (skipIsByDesign(job, result, intentionalSkips)) continue;
    // Cancelled and skipped are failures even when gate.json is UNKNOWN.
    // The UNKNOWN waiver below applies only to result === 'failure'.
    if (result === 'cancelled' || result === 'skipped') {
      failures.push(
        `${job}: expected success, received ${formatReceived(result)}`,
      );
      continue;
    }
    if (result !== 'success') {
      // A failed job whose receipt is UNKNOWN is not a second hard failure.
      // The UNKNOWN BLOCK row still keeps readiness from passing.
      if (result === 'failure' && gates?.[job]?.status === 'UNKNOWN') continue;
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
  if (receipt.status === 'UNKNOWN') {
    if (sha && receipt.sha && receipt.sha !== sha) {
      failures.push(`${job}: gate.json sha does not match this run`);
    }
    return failures;
  }
  if (receipt.status === 'INFO') {
    const unchanged = receipt.mutationScope?.mutableSourceChanged === false;
    const text = String(receipt.value || '').includes(
      'no mutable source changed',
    );
    if (job !== 'mutation-tests' || !unchanged || !text) {
      failures.push(
        `${job}: gate.json status is ${formatReceived(receipt.status ?? null)}`,
      );
      return failures;
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

export function evaluateReadiness({
  needs,
  gates,
  sha = '',
  intentionalSkips = INTENTIONAL_SKIP_JOBS,
}) {
  const failures = resultFailures(needs, gates, intentionalSkips);
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

function plainToken(value) {
  const text = String(value || '');
  if (!/^[A-Za-z0-9._:-]+$/.test(text)) return null;
  return text;
}

function plainRef(value) {
  const text = String(value || '');
  if (!/^[A-Za-z0-9._/-]+$/.test(text)) return null;
  return text;
}

export function gateArtifactUrl(repo, runId, artifactId) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(String(repo || ''))) {
    return null;
  }
  if (!/^[1-9]\d*$/.test(String(runId || ''))) return null;
  if (!/^[1-9]\d*$/.test(String(artifactId || ''))) return null;
  return `https://github.com/${repo}/actions/runs/${runId}/artifacts/${artifactId}`;
}

export function pullRequestFromEnv(env) {
  const repository = plainRef(env.GITHUB_REPOSITORY || '')?.includes('/')
    ? String(env.GITHUB_REPOSITORY)
    : '';
  const validRepo = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository);
  const number = String(env.PR_NUMBER || '');
  const validNumber = /^[1-9]\d*$/.test(number);
  return {
    number: validNumber ? number : null,
    url:
      validRepo && validNumber
        ? `https://github.com/${repository}/pull/${number}`
        : null,
    headSha: plainToken(env.PR_HEAD_SHA),
    baseSha: plainToken(env.PR_BASE_SHA),
    baseRef: plainRef(env.PR_BASE_REF),
  };
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
  const rowFail = rows.some(
    (row) => row?.mode === 'BLOCK' && row?.status === 'FAIL',
  );
  const blockUnknown = rows.some(
    (row) => row?.mode === 'BLOCK' && row?.status === 'UNKNOWN',
  );
  const status =
    failures.length > 0 || rowFail ? 'FAIL' : blockUnknown ? 'UNKNOWN' : 'PASS';
  const mutationGate = gates?.['mutation-tests'] ?? null;
  return {
    schemaVersion: 1,
    gate: 'ci-readiness',
    sha: env.GITHUB_SHA || null,
    headSha: env.PR_HEAD_SHA || null,
    runId: runId || null,
    runAttempt,
    runUrl,
    status,
    result: status === 'PASS' ? 'success' : 'failure',
    requiredJobs: REQUIRED_JOBS,
    jobs,
    failures,
    rows,
    mutation: mutationGate?.stryker ?? null,
    survivors: mutationGate?.survivors ?? null,
    mutationScope: mutationGate?.mutationScope ?? null,
    attemptLine: attemptLine(runAttempt),
    unwired: unwiredGateRows(),
    pullRequest: pullRequestFromEnv(env),
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

export function gateArtifactName(job, attempt) {
  return attempt ? `gate-${job}-attempt-${attempt}` : `gate-${job}`;
}

function wholeAttempt(value) {
  const attempt = Number(value);
  return Number.isInteger(attempt) && attempt > 0 ? attempt : 0;
}

// Place a job by its start time against each attempt's run_started_at.
// The jobs API run_attempt field is not used: a re-run copies carried-over
// jobs with a new id and the new attempt number, while their timestamps
// stay on the attempt that actually ran them.
export function attemptForTimestamp(timestamp, attempts) {
  const at = Date.parse(timestamp ?? '');
  if (!Number.isFinite(at)) return 0;
  const windows = [];
  for (const item of Array.isArray(attempts) ? attempts : []) {
    const attempt = wholeAttempt(item?.run_attempt ?? item?.attempt);
    const started = Date.parse(item?.run_started_at || item?.created_at || '');
    if (attempt < 1 || !Number.isFinite(started)) continue;
    windows.push({ attempt, started });
  }
  windows.sort(
    (left, right) =>
      left.started - right.started || left.attempt - right.attempt,
  );
  let chosen = 0;
  for (const window of windows) {
    if (window.started <= at) chosen = window.attempt;
    else break;
  }
  return chosen;
}

// The receipt that counts is the latest attempt whose window contains the
// job's started_at. A job that started in this attempt must use this
// attempt's artifact. An older passing receipt does not replace it. When
// the job list or the timestamps cannot be placed, stay on the current
// attempt so a missing receipt fails closed.
export function receiptAttemptForJob(
  runJobs,
  jobId,
  currentAttempt,
  attempts = [],
) {
  const current = wholeAttempt(currentAttempt);
  if (current === 0) return '';
  if (current === 1) return '1';
  const name = JOB_DISPLAY_NAMES[jobId];
  let best = 0;
  let saw = false;
  for (const job of Array.isArray(runJobs) ? runJobs : []) {
    if (!job || job.name !== name) continue;
    saw = true;
    const placed = attemptForTimestamp(
      job.started_at || job.completed_at,
      attempts,
    );
    if (placed < 1 || placed > current) continue;
    if (placed > best) best = placed;
  }
  if (!saw || best < 1) return String(current);
  return String(best);
}

export function selectNamedArtifact(artifacts, name) {
  const matches = (Array.isArray(artifacts) ? artifacts : []).filter(
    (item) => item && item.name === name && item.expired !== true,
  );
  matches.sort((left, right) =>
    String(right.updated_at || right.created_at || '').localeCompare(
      String(left.updated_at || left.created_at || ''),
    ),
  );
  return matches[0] ?? null;
}

async function listPaged(fetchImpl, token, urlForPage, field, failure) {
  const items = [];
  for (let page = 1; page <= 20; page += 1) {
    const listed = await fetchImpl(urlForPage(page), {
      headers: authHeaders(token),
    });
    if (!listed.ok) {
      throw new Error(`${failure}: ${listed.status}`);
    }
    const body = await listed.json();
    const batch = Array.isArray(body[field]) ? body[field] : [];
    items.push(...batch);
    if (batch.length < 100) break;
  }
  return items;
}

async function listRunArtifacts(fetchImpl, repo, token, runId) {
  return listPaged(
    fetchImpl,
    token,
    (page) =>
      `https://api.github.com/repos/${repo}/actions/runs/${runId}/artifacts?per_page=100&page=${page}`,
    'artifacts',
    'gate artifact list failed',
  );
}

async function listRunJobs(fetchImpl, repo, token, runId) {
  return listPaged(
    fetchImpl,
    token,
    (page) =>
      `https://api.github.com/repos/${repo}/actions/runs/${runId}/jobs?filter=all&per_page=100&page=${page}`,
    'jobs',
    'job attempt list failed',
  );
}

async function listRunAttempts(fetchImpl, repo, token, runId, currentAttempt) {
  const attempts = [];
  const current = wholeAttempt(currentAttempt);
  for (let attempt = 1; attempt <= current; attempt += 1) {
    const response = await fetchImpl(
      `https://api.github.com/repos/${repo}/actions/runs/${runId}/attempts/${attempt}`,
      { headers: authHeaders(token) },
    );
    if (!response.ok) {
      throw new Error(`run attempt list failed: ${response.status}`);
    }
    attempts.push(await response.json());
  }
  return attempts;
}

export async function collectGateReceipts({
  fetchImpl = globalThis.fetch,
  repo,
  token,
  runId,
  destDir,
  unpack = defaultUnpack,
  jobs = REQUIRED_JOBS,
  attempt = '',
}) {
  if (!repo || !token || !runId) {
    throw new Error(
      'repository, token, and run id are required to fetch gate.json',
    );
  }
  const artifacts = await listRunArtifacts(fetchImpl, repo, token, runId);
  const current = wholeAttempt(attempt);
  const runJobs =
    current > 1 ? await listRunJobs(fetchImpl, repo, token, runId) : [];
  const runAttempts =
    current > 1
      ? await listRunAttempts(fetchImpl, repo, token, runId, attempt)
      : [];
  const gates = {};
  for (const job of jobs) {
    const resolved = receiptAttemptForJob(runJobs, job, attempt, runAttempts);
    if (resolved && attempt && resolved !== String(attempt)) {
      console.log(
        `${job}: using gate receipt from attempt ${resolved} of this run`,
      );
    }
    const name = gateArtifactName(job, resolved);
    const artifact = selectNamedArtifact(artifacts, name);
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
    const receipt = readGateFile(dir);
    if (isObject(receipt)) {
      const artifactUrl = gateArtifactUrl(repo, runId, artifact.id);
      if (artifactUrl) {
        receipt.artifactUrl = artifactUrl;
        receipt.artifactName = name;
        receipt.artifactId = artifact.id;
      }
    }
    gates[job] = receipt;
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
        attempt: env.GITHUB_RUN_ATTEMPT || '',
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
