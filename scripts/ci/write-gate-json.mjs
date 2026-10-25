import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  evidenceForJob,
  logLinesForReceipt,
  sha256File,
} from './gate-metrics.mjs';

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
    survivors: extra.survivors ?? null,
    mutationScope: extra.mutationScope ?? null,
    logLines: extra.logLines ?? null,
  };
  if (
    (outcome === 'success' || outcome === 'failure' || outcome === '') &&
    extra.gateStatus === 'UNKNOWN'
  ) {
    receipt.status = 'UNKNOWN';
    receipt.result = 'failure';
    receipt.exitCode = 1;
  } else if (extra.gateStatus === 'FAIL') {
    receipt.status = 'FAIL';
    receipt.result = 'failure';
    receipt.exitCode = 1;
  } else if (extra.gateStatus === 'INFO') {
    receipt.status = 'INFO';
    receipt.result = 'success';
    receipt.exitCode = 0;
  }
  if (extra.informational) {
    receipt.status = extra.status === 'UNKNOWN' ? 'UNKNOWN' : 'INFO';
    receipt.result = mapped.result;
  }
  return receipt;
}

export function gateJsonPath(job, root = 'reports/quality/gates') {
  return join(root, job, 'gate.json');
}

export function evidenceArtifactName(sourcePath) {
  const name = basename(String(sourcePath || ''));
  if (!name || name === '.' || name === '..' || name === 'gate.json') {
    return 'evidence.bin';
  }
  return name;
}

// Copies the file that was hashed into the same directory as gate.json.
// The digest is not recomputed into a new status. A mismatch fails the write.
export function stageHashedEvidence(
  receipt,
  sourcePath,
  root = 'reports/quality/gates',
) {
  if (!receipt?.evidenceSha256) return receipt;
  if (!sourcePath || !existsSync(sourcePath)) {
    throw new Error(`${receipt.job}: hashed evidence file is missing`);
  }
  const dir = dirname(gateJsonPath(receipt.job, root));
  mkdirSync(dir, { recursive: true });
  const name = evidenceArtifactName(sourcePath);
  const dest = join(dir, name);
  if (resolve(sourcePath) !== resolve(dest)) copyFileSync(sourcePath, dest);
  const actual = sha256File(dest);
  if (actual !== receipt.evidenceSha256) {
    throw new Error(
      `${receipt.job}: staged ${name} sha256 does not match the receipt`,
    );
  }
  receipt.evidenceFile = name;
  return receipt;
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
  try {
    stageHashedEvidence(receipt, extra.evidencePath, process.env.GATE_ROOT);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  const path = writeGateReceipt(receipt, process.env.GATE_ROOT);
  publishGateLog(receipt, process.env);
  console.log(`Wrote ${path} (${receipt.status})`);
  if (receipt.status === 'FAIL' || receipt.status === 'UNKNOWN') {
    process.exit(1);
  }
}
