import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { evidenceForJob, logLinesForReceipt } from './gate-metrics.mjs';

const OUTCOMES = {
  success: { status: 'PASS', result: 'success', exitCode: 0 },
  failure: { status: 'FAIL', result: 'failure', exitCode: 1 },
  cancelled: { status: 'FAIL', result: 'cancelled', exitCode: 1 },
  skipped: { status: 'FAIL', result: 'skipped', exitCode: 1 },
};

export function buildGateReceipt({
  job,
  outcome,
  sha = '',
  runId = '',
  runAttempt = '',
  runUrl = null,
  name = job,
  extra = {},
}) {
  const mapped = OUTCOMES[outcome] ?? {
    status: 'FAIL',
    result: 'failure',
    exitCode: 1,
  };
  const receipt = {
    schemaVersion: 1,
    job,
    gate: job,
    name,
    sha: sha || null,
    runId: runId || null,
    runAttempt: runAttempt || null,
    runUrl: runUrl || null,
    status: mapped.status,
    result: mapped.result,
    exitCode: mapped.exitCode,
    value: extra.value ?? null,
    floor: extra.floor ?? null,
    evidenceSha256: extra.evidenceSha256 ?? null,
    metrics: extra.metrics ?? null,
    coverage: extra.coverage ?? null,
    stryker: extra.stryker ?? null,
    logLines: extra.logLines ?? null,
  };
  if (extra.informational) {
    receipt.status = extra.status === 'UNKNOWN' ? 'UNKNOWN' : 'INFO';
    receipt.result = mapped.result;
  }
  return receipt;
}

export function gateJsonPath(job, root = 'reports/quality/gates') {
  return join(root, job, 'gate.json');
}

export function writeGateReceipt(receipt, root = 'reports/quality/gates') {
  const path = gateJsonPath(receipt.job, root);
  mkdirSync(dirname(path), { recursive: true });
  const stored = { ...receipt };
  delete stored.logLines;
  writeFileSync(path, `${JSON.stringify(stored, null, 2)}\n`);
  return path;
}

export function publishGateLog(receipt, env = process.env) {
  const text = `${logLinesForReceipt(receipt).join('\n')}\n`;
  process.stdout.write(text);
  if (env.GITHUB_STEP_SUMMARY) {
    appendFileSync(env.GITHUB_STEP_SUMMARY, `\n${text}`);
  }
}

function runUrlFromEnv(env) {
  const server = env.GITHUB_SERVER_URL || 'https://github.com';
  const repository = env.GITHUB_REPOSITORY || '';
  const runId = env.GITHUB_RUN_ID || '';
  if (!repository || !runId) return null;
  return `${server}/${repository}/actions/runs/${runId}`;
}

function isDirectRun() {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
}

if (isDirectRun()) {
  const job = process.env.GATE_JOB;
  if (!job) {
    console.error('GATE_JOB is required');
    process.exit(1);
  }
  let extra = {};
  try {
    extra = evidenceForJob(job, process.env);
  } catch (error) {
    extra = {
      value: `counts unavailable: ${error.message}`,
      floor: null,
      logLines: [`${job}: counts unavailable: ${error.message}`],
    };
  }
  const receipt = buildGateReceipt({
    job,
    outcome: process.env.GATE_OUTCOME ?? '',
    sha: process.env.GITHUB_SHA ?? '',
    runId: process.env.GITHUB_RUN_ID ?? '',
    runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? '',
    runUrl: runUrlFromEnv(process.env),
    name: process.env.GATE_NAME || job,
    extra,
  });
  const path = writeGateReceipt(receipt, process.env.GATE_ROOT);
  publishGateLog(receipt, process.env);
  console.log(`Wrote ${path} (${receipt.status})`);
}
