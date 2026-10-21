import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

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
}) {
  const mapped = OUTCOMES[outcome] ?? {
    status: 'FAIL',
    result: 'failure',
    exitCode: 1,
  };
  return {
    schemaVersion: 1,
    job,
    gate: job,
    sha: sha || null,
    runId: runId || null,
    runAttempt: runAttempt || null,
    status: mapped.status,
    result: mapped.result,
    exitCode: mapped.exitCode,
  };
}

export function gateJsonPath(job, root = 'reports/quality/gates') {
  return join(root, job, 'gate.json');
}

export function writeGateReceipt(receipt, root = 'reports/quality/gates') {
  const path = gateJsonPath(receipt.job, root);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(receipt, null, 2)}\n`);
  return path;
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
  const receipt = buildGateReceipt({
    job,
    outcome: process.env.GATE_OUTCOME ?? '',
    sha: process.env.GITHUB_SHA ?? '',
    runId: process.env.GITHUB_RUN_ID ?? '',
    runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? '',
  });
  const path = writeGateReceipt(receipt, process.env.GATE_ROOT);
  console.log(`Wrote ${path} (${receipt.status})`);
}
