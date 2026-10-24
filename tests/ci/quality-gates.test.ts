import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  applyStrykerCacheDecision,
  decideStrykerCache,
} from '../../scripts/ci/accept-stryker-cache.mjs';
import {
  JOB_DISPLAY_NAMES,
  REQUIRED_JOBS,
  buildReport,
  collectGateReceipts,
  evaluateReadiness,
  jobResult,
  receiptAttemptForJob,
} from '../../scripts/ci/check-ci-readiness.mjs';
import {
  checkScheduledWorkflow,
  warningForWorkflowState,
} from '../../scripts/ci/check-scheduled-workflow.mjs';
import { buildGateReceipt } from '../../scripts/ci/write-gate-json.mjs';
import {
  assertPrefixRestoreHasNoScore,
  buildMutationSummary,
} from '../../scripts/ci/write-mutation-summary.mjs';

const root = resolve(import.meta.dirname, '../..');
const workflow = readFileSync(
  resolve(root, '.github/workflows/ci.yml'),
  'utf8',
);

function successfulNeeds() {
  return Object.fromEntries(
    REQUIRED_JOBS.map((job) => [job, { result: 'success' }]),
  );
}

function passingMutation() {
  return {
    value: 'Profile: incremental. 10 tested this run, 0 cached. Score 80.00%.',
    floor: 'break 68',
    stryker: {
      profile: 'incremental',
      killed: 8,
      survived: 2,
      timeout: 0,
      noCoverage: 0,
      scored: 10,
      detectedScore: 80,
      killedOnlyScore: 80,
      timeoutPct: 0,
      timeoutAbove2: false,
      zeroMutants: false,
      countsUnknown: false,
      tested: 10,
      cached: 0,
    },
    mutationScope: {
      mode: 'changed-files',
      mutableSourceChanged: true,
      changedFiles: ['src/a.ts'],
      scopeLabel: 'changed files: src/a.ts',
    },
  };
}

function passingGates(sha = 'abc') {
  return Object.fromEntries(
    REQUIRED_JOBS.map((job) => [
      job,
      buildGateReceipt({
        job,
        outcome: 'success',
        sha,
        runId: '1',
        runAttempt: '1',
        extra:
          job === 'mutation-tests' ? passingMutation() : { value: `${job} ok` },
      }),
    ]),
  );
}

describe('ci workflow contract', () => {
  it('triggers push on develop and pull requests into develop', () => {
    const pullAt = workflow.indexOf('  pull_request:\n');
    const jobsAt = workflow.indexOf('\njobs:');
    const push = workflow.slice(0, pullAt);
    const pull = workflow.slice(pullAt, jobsAt);
    expect(push).toContain('- develop');
    expect(pull).toContain('- develop');
    expect(push).not.toMatch(/^\s+- dev$/m);
  });

  it('does not gate required jobs on head or base ref', () => {
    const conditions = workflow
      .split('\n')
      .filter((line) => line.includes('if:'));
    for (const line of conditions) {
      expect(line).not.toContain('github.head_ref');
      expect(line).not.toContain('github.base_ref');
    }
    expect(workflow).not.toContain('github.head_ref');
  });

  it('runs ci-readiness with if always and every required job', () => {
    const readiness = workflow.slice(workflow.indexOf('  ci-readiness:\n'));
    expect(readiness).toContain('if: always()');
    const needsAt = readiness.indexOf('    needs:\n');
    const runsAt = readiness.indexOf('    runs-on:');
    const needs = readiness.slice(needsAt, runsAt);
    const listed = needs
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('- '))
      .map((line) => line.slice(2));
    expect(listed).toEqual(REQUIRED_JOBS);
    expect(readiness).toContain('FETCH_GATE_ARTIFACTS');
    expect(readiness).toContain('node scripts/ci/check-ci-readiness.mjs');
  });

  it('records job status so an earlier step failure is not a skipped receipt', () => {
    expect(workflow).toContain('GATE_OUTCOME: ${{ job.status }}');
    expect(workflow).not.toContain('steps.gate.outcome');
  });

  it('restores the Stryker PR cache only on an exact key', () => {
    const cacheStart = workflow.indexOf(
      'Cache Stryker incremental report (exact key only)',
    );
    const cacheEnd = workflow.indexOf('Reject non-exact Stryker cache');
    const cache = workflow.slice(cacheStart, cacheEnd);
    expect(cache).not.toContain('restore-keys');
    expect(cache).toContain('stryker-incremental-pr-');
    expect(cache).toContain("outputs.profile == 'incremental'");
    expect(workflow).toContain('node scripts/ci/accept-stryker-cache.mjs');
    expect(workflow).not.toContain('mutation-cache-only.mjs');
  });

  it('posts two stickies and deletes the old maxframe quality header', () => {
    expect(workflow).toContain('header: quality-gates-report');
    expect(workflow).toContain('header: mutation-report');
    expect(workflow).toContain('header: maxframe-quality');
    expect(workflow).toContain('delete: true');
    expect(workflow).toContain('node scripts/ci/render-stickies.mjs');
    expect(workflow).toContain(
      "github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository",
    );
    expect(workflow).not.toContain('code-coverage-results.md');
    expect(workflow).not.toContain('mutation-test-results.md');
    const comments = workflow.slice(workflow.indexOf('  quality-comments:\n'));
    expect(comments).toContain('pull-requests: write');
    expect(workflow.replace(comments, '')).not.toContain(
      'pull-requests: write',
    );
    expect(workflow).not.toContain('actions: write');
    expect(workflow).toContain('actions: read');
    expect(workflow).toContain('gate-lint-attempt-${{ github.run_attempt }}');
    const sizeLimit = readFileSync(
      resolve(root, '.github/workflows/size-limit.yml'),
      'utf8',
    );
    expect(sizeLimit).toContain('header: size-limit-report');
  });

  it('removes npm ci --force from every workflow', () => {
    const dir = resolve(root, '.github/workflows');
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.yml')) continue;
      const text = readFileSync(resolve(dir, name), 'utf8');
      expect(text, name).not.toContain('npm ci --force');
    }
  });
});

describe('ci readiness', () => {
  it('passes only when every required job succeeded and gate.json is PASS', () => {
    const sha = 'abc';
    expect(
      evaluateReadiness({
        needs: successfulNeeds(),
        gates: passingGates(sha),
        sha,
      }),
    ).toEqual([]);
  });

  it('treats skipped, cancelled, failed, and missing results as red', () => {
    for (const result of ['skipped', 'cancelled', 'failure', null]) {
      const needs = successfulNeeds();
      needs.lint = result === null ? {} : { result };
      const failures = evaluateReadiness({
        needs,
        gates: passingGates(),
        sha: 'abc',
      });
      expect(failures.some((line) => line.startsWith('lint:'))).toBe(true);
      expect(jobResult(needs, 'lint')).not.toBe('success');
    }
  });

  it('fails when a successful job is missing gate.json', () => {
    const gates = passingGates('abc');
    gates['unit-tests'] = null;
    const failures = evaluateReadiness({
      needs: successfulNeeds(),
      gates,
      sha: 'abc',
    });
    expect(failures).toContain('unit-tests: missing gate.json');
  });

  it('accepts mutation INFO only when the diff shows no mutable source changed', () => {
    const sha = 'abc';
    const gates = passingGates(sha);
    gates['mutation-tests'] = buildGateReceipt({
      job: 'mutation-tests',
      outcome: 'success',
      sha,
      extra: {
        gateStatus: 'INFO',
        value: 'Mutation: INFO. no mutable source changed.',
        floor: 'break 68',
        mutationScope: {
          mutableSourceChanged: false,
          scopeLabel: 'No mutable source changed.',
        },
      },
    });
    expect(
      evaluateReadiness({
        needs: successfulNeeds(),
        gates,
        sha,
      }),
    ).toEqual([]);
    const closed = passingGates(sha);
    closed['mutation-tests'] = buildGateReceipt({
      job: 'mutation-tests',
      outcome: 'success',
      sha,
      extra: {
        gateStatus: 'INFO',
        value: 'Mutation: INFO. no mutable source changed.',
        floor: 'break 68',
        mutationScope: { mutableSourceChanged: null },
      },
    });
    const failures = evaluateReadiness({
      needs: successfulNeeds(),
      gates: closed,
      sha,
    });
    expect(failures.some((line) => line.includes('gate.json status'))).toBe(
      true,
    );
  });

  it('fails when gate.json does not pass', () => {
    const gates = passingGates('abc');
    gates.format = buildGateReceipt({
      job: 'format',
      outcome: 'failure',
      sha: 'abc',
    });
    const failures = evaluateReadiness({
      needs: successfulNeeds(),
      gates,
      sha: 'abc',
    });
    expect(failures.some((line) => line.includes('gate.json status'))).toBe(
      true,
    );
  });

  it('writes a failing report for invalid needs JSON', () => {
    const dir = mkdtempSync(join(tmpdir(), 'readiness-'));
    const reportPath = join(dir, 'ci-readiness.json');
    const outputPath = join(dir, 'github-output.txt');
    writeFileSync(outputPath, '');
    const result = spawnSync(
      process.execPath,
      ['scripts/ci/check-ci-readiness.mjs'],
      {
        cwd: root,
        env: {
          ...process.env,
          CI_NEEDS_JSON: 'not-json',
          CI_READINESS_REPORT: reportPath,
          GITHUB_OUTPUT: outputPath,
          GATE_ROOT: join(dir, 'gates'),
        },
        encoding: 'utf8',
      },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('CI readiness: FAIL');
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    expect(report.status).toBe('FAIL');
    expect(readFileSync(outputPath, 'utf8')).toContain('status=FAIL');
  });

  it('records pass and fail in the report the slice 1 comment can read', () => {
    const passed = buildReport({
      needs: successfulNeeds(),
      gates: passingGates('abc'),
      failures: [],
      env: {
        GITHUB_SHA: 'abc',
        GITHUB_RUN_ID: '9',
        GITHUB_RUN_ATTEMPT: '1',
        GITHUB_REPOSITORY: 'joaobispo2077/maxframe',
      },
    });
    expect(passed.status).toBe('PASS');
    expect(passed.result).toBe('success');
    expect(passed.jobs.lint.accepted).toBe(true);
    expect(passed.runUrl).toBe(
      'https://github.com/joaobispo2077/maxframe/actions/runs/9',
    );
    expect(passed.rows.find((row) => row.job === 'lint').status).toBe('PASS');
  });

  it('exits non-zero when a BLOCK row has no counts', () => {
    const dir = mkdtempSync(join(tmpdir(), 'readiness-unknown-'));
    const reportPath = join(dir, 'ci-readiness.json');
    const outputPath = join(dir, 'github-output.txt');
    writeFileSync(outputPath, '');
    const gates = passingGates('abc');
    gates['e2e-tests'] = buildGateReceipt({
      job: 'e2e-tests',
      outcome: 'success',
      sha: 'abc',
      runId: '1',
      runAttempt: '1',
      extra: { value: 'passed, failed, skipped unavailable' },
    });
    for (const job of REQUIRED_JOBS) {
      const gateDir = join(dir, `gate-${job}`);
      mkdirSync(gateDir, { recursive: true });
      writeFileSync(
        join(gateDir, 'gate.json'),
        `${JSON.stringify(gates[job], null, 2)}\n`,
      );
    }
    const result = spawnSync(
      process.execPath,
      ['scripts/ci/check-ci-readiness.mjs'],
      {
        cwd: root,
        env: {
          ...process.env,
          CI_NEEDS_JSON: JSON.stringify(successfulNeeds()),
          CI_READINESS_REPORT: reportPath,
          GITHUB_OUTPUT: outputPath,
          GATE_INCOMING_DIR: dir,
          GATE_ROOT: join(dir, 'gates'),
          GITHUB_SHA: 'abc',
          GITHUB_REPOSITORY: '',
          GITHUB_RUN_ID: '',
          GH_TOKEN: '',
          GITHUB_TOKEN: '',
        },
        encoding: 'utf8',
      },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('CI readiness: UNKNOWN');
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    const e2e = report.rows.find((row) => row.job === 'e2e-tests');
    expect(report.status).toBe('UNKNOWN');
    expect(report.result).not.toBe('success');
    expect(e2e.status).toBe('UNKNOWN');
    expect(e2e.value).not.toContain('PASS');
    expect(readFileSync(outputPath, 'utf8')).toContain('status=UNKNOWN');
  });
});

function jobExecution(job, runAttempt, conclusion = 'success') {
  return {
    name: JOB_DISPLAY_NAMES[job],
    run_attempt: runAttempt,
    conclusion,
    html_url: `https://github.com/example/job/${job}/${runAttempt}`,
  };
}

function storedArtifact(id, job, runAttempt, receipt, extra = {}) {
  return {
    id,
    name: `gate-${job}-attempt-${runAttempt}`,
    expired: false,
    updated_at: `2026-10-24T00:00:0${runAttempt}Z`,
    receipt,
    ...extra,
  };
}

function receiptFor(job, sha = 'abc', outcome = 'success') {
  return buildGateReceipt({
    job,
    outcome,
    sha,
    runId: '99',
    runAttempt: '1',
    extra:
      job === 'mutation-tests' ? passingMutation() : { value: `${job} ok` },
  });
}

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
    arrayBuffer: async () => new Uint8Array([1]).buffer,
  };
}

async function collectAttempt({ attempt, artifacts, executions }) {
  const dir = mkdtempSync(join(tmpdir(), 'gate-attempts-'));
  const urls = [];
  const zipIds = [];
  const byId = new Map(artifacts.map((item) => [item.id, item.receipt]));
  const fetchImpl = async (url) => {
    urls.push(url);
    if (url.includes('/artifacts?')) {
      return jsonResponse({
        artifacts: artifacts.map((item) => ({
          id: item.id,
          name: item.name,
          expired: item.expired,
          updated_at: item.updated_at,
        })),
      });
    }
    if (url.includes('/jobs?')) {
      return jsonResponse({ jobs: executions });
    }
    const zip = url.match(/\/artifacts\/(\d+)\/zip$/);
    if (zip) {
      zipIds.push(Number(zip[1]));
      return jsonResponse({});
    }
    throw new Error(`unexpected url ${url}`);
  };
  const gates = await collectGateReceipts({
    fetchImpl,
    repo: 'joaobispo2077/maxframe',
    token: 'token',
    runId: '99',
    destDir: dir,
    attempt,
    unpack: (_zipPath, dest) => {
      const id = zipIds[zipIds.length - 1];
      writeFileSync(
        join(dest, 'gate.json'),
        `${JSON.stringify(byId.get(id))}\n`,
      );
    },
  });
  return { gates, urls, zipIds };
}

function readinessReport(gates, sha = 'abc', attempt = '1') {
  const failures = evaluateReadiness({
    needs: successfulNeeds(),
    gates,
    sha,
  });
  const report = buildReport({
    needs: successfulNeeds(),
    gates,
    failures,
    env: { GITHUB_SHA: sha, GITHUB_RUN_ATTEMPT: attempt },
  });
  return { failures, report };
}

describe('ci readiness across run attempts', () => {
  it('uses attempt 1 on the first run and ignores a later execution', () => {
    expect(receiptAttemptForJob([], 'lint', '1')).toBe('1');
    expect(receiptAttemptForJob([jobExecution('lint', 4)], 'lint', '1')).toBe(
      '1',
    );
    expect(receiptAttemptForJob([], 'lint', '')).toBe('');
    expect(
      receiptAttemptForJob(
        [jobExecution('lint', 3), jobExecution('lint', 1)],
        'lint',
        '2',
      ),
    ).toBe('1');
    expect(receiptAttemptForJob([], 'lint', '2')).toBe('2');
  });

  it('passes on the first attempt when every gate receipt is from that attempt', async () => {
    const artifacts = REQUIRED_JOBS.map((job, index) =>
      storedArtifact(index + 1, job, 1, receiptFor(job)),
    );
    const { gates, urls } = await collectAttempt({
      attempt: '1',
      artifacts,
      executions: REQUIRED_JOBS.map((job) => jobExecution(job, 1)),
    });
    expect(urls.some((url) => url.includes('/jobs?'))).toBe(false);
    const { failures, report } = readinessReport(gates, 'abc', '1');
    expect(failures).toEqual([]);
    expect(report.status).toBe('PASS');
    expect(report.result).toBe('success');
  });

  it('passes a re-run when receipts for jobs that were not re-run come from attempt 1', async () => {
    const artifacts = [];
    const executions = [];
    let id = 1;
    for (const job of REQUIRED_JOBS) {
      if (job === 'unit-tests') {
        artifacts.push(
          storedArtifact(id, job, 1, receiptFor(job, 'abc', 'failure')),
        );
        executions.push(jobExecution(job, 1, 'failure'));
        id += 1;
        artifacts.push(storedArtifact(id, job, 2, receiptFor(job)));
        executions.push(jobExecution(job, 2, 'success'));
        id += 1;
        continue;
      }
      artifacts.push(storedArtifact(id, job, 1, receiptFor(job)));
      executions.push(jobExecution(job, 1, 'success'));
      id += 1;
    }
    const { gates, urls, zipIds } = await collectAttempt({
      attempt: '2',
      artifacts,
      executions,
    });
    expect(urls.some((url) => url.includes('filter=all'))).toBe(true);
    const failedAttempt = artifacts.find(
      (item) => item.name === 'gate-unit-tests-attempt-1',
    );
    const passedAttempt = artifacts.find(
      (item) => item.name === 'gate-unit-tests-attempt-2',
    );
    expect(zipIds).toContain(passedAttempt.id);
    expect(zipIds).not.toContain(failedAttempt.id);
    expect(gates.lint.runAttempt).toBe('1');
    expect(gates['unit-tests'].status).toBe('PASS');
    const { failures, report } = readinessReport(gates, 'abc', '2');
    expect(failures).toEqual([]);
    expect(report.status).toBe('PASS');
    expect(report.result).toBe('success');
  });

  it('fails when a required receipt is missing from every attempt', async () => {
    const artifacts = [
      {
        id: 500,
        name: 'gate-format',
        expired: false,
        updated_at: '2026-10-24T00:00:09Z',
        receipt: receiptFor('format'),
      },
      {
        id: 501,
        name: 'gate-format-attempt-1',
        expired: true,
        updated_at: '2026-10-24T00:00:08Z',
        receipt: receiptFor('format'),
      },
      {
        id: 502,
        name: 'gate-format-attempt-2',
        expired: true,
        updated_at: '2026-10-24T00:00:07Z',
        receipt: receiptFor('format'),
      },
    ];
    const executions = [
      jobExecution('format', 1, 'success'),
      jobExecution('format', 2, 'success'),
    ];
    let id = 1;
    for (const job of REQUIRED_JOBS) {
      if (job === 'format') continue;
      artifacts.push(storedArtifact(id, job, 1, receiptFor(job)));
      executions.push(jobExecution(job, 1, 'success'));
      id += 1;
    }
    const { gates, zipIds } = await collectAttempt({
      attempt: '2',
      artifacts,
      executions,
    });
    expect(zipIds).not.toContain(500);
    expect(zipIds).not.toContain(501);
    expect(zipIds).not.toContain(502);
    expect(gates.format).toBeNull();
    const { failures, report } = readinessReport(gates, 'abc', '2');
    expect(failures).toContain('format: missing gate.json');
    expect(report.status).toBe('FAIL');
    expect(report.result).not.toBe('success');
  });

  it('fails when the receipt from the attempt that ran the job has a different head SHA', async () => {
    const artifacts = [];
    const executions = [];
    let id = 1;
    for (const job of REQUIRED_JOBS) {
      const sha = job === 'lint' ? 'stale-head' : 'abc';
      const attempt = job === 'unit-tests' ? 2 : 1;
      artifacts.push(storedArtifact(id, job, attempt, receiptFor(job, sha)));
      executions.push(jobExecution(job, attempt, 'success'));
      if (job === 'unit-tests') {
        artifacts.push(
          storedArtifact(
            id + 1,
            job,
            1,
            receiptFor(job, 'stale-head', 'failure'),
          ),
        );
        executions.push(jobExecution(job, 1, 'failure'));
        id += 2;
        continue;
      }
      id += 1;
    }
    const { gates } = await collectAttempt({
      attempt: '2',
      artifacts,
      executions,
    });
    expect(gates.lint.sha).toBe('stale-head');
    const { failures, report } = readinessReport(gates, 'abc', '2');
    expect(failures).toContain('lint: gate.json sha does not match this run');
    expect(report.status).toBe('FAIL');
    expect(report.result).not.toBe('success');
    expect(report.status).not.toBe('PASS');
  });

  it('fails a re-run when the latest receipt failed and an earlier attempt passed', async () => {
    const artifacts = [];
    const executions = [];
    let id = 1;
    for (const job of REQUIRED_JOBS) {
      if (job === 'unit-tests') {
        artifacts.push(storedArtifact(id, job, 1, receiptFor(job)));
        executions.push(jobExecution(job, 1, 'success'));
        id += 1;
        artifacts.push(
          storedArtifact(id, job, 2, receiptFor(job, 'abc', 'failure')),
        );
        executions.push(jobExecution(job, 2, 'failure'));
        id += 1;
        continue;
      }
      artifacts.push(storedArtifact(id, job, 1, receiptFor(job)));
      executions.push(jobExecution(job, 1, 'success'));
      id += 1;
    }
    const { gates, zipIds } = await collectAttempt({
      attempt: '2',
      artifacts,
      executions,
    });
    const olderPass = artifacts.find(
      (item) => item.name === 'gate-unit-tests-attempt-1',
    );
    expect(zipIds).not.toContain(olderPass.id);
    expect(gates['unit-tests'].status).toBe('FAIL');
    const { failures, report } = readinessReport(gates, 'abc', '2');
    expect(failures.some((line) => line.startsWith('unit-tests:'))).toBe(true);
    expect(report.status).toBe('FAIL');
    expect(report.status).not.toBe('PASS');
  });

  it('fails when a re-run job has no new receipt even if an earlier attempt passed', async () => {
    const artifacts = [];
    const executions = [
      jobExecution('unit-tests', 1, 'success'),
      jobExecution('unit-tests', 2, 'success'),
    ];
    let id = 1;
    for (const job of REQUIRED_JOBS) {
      if (job === 'unit-tests') {
        artifacts.push(storedArtifact(id, job, 1, receiptFor(job)));
        id += 1;
        continue;
      }
      artifacts.push(storedArtifact(id, job, 1, receiptFor(job)));
      executions.push(jobExecution(job, 1, 'success'));
      id += 1;
    }
    const { gates, zipIds } = await collectAttempt({
      attempt: '2',
      artifacts,
      executions,
    });
    expect(zipIds).not.toContain(
      artifacts.find((item) => item.name === 'gate-unit-tests-attempt-1').id,
    );
    expect(gates['unit-tests']).toBeNull();
    const { failures, report } = readinessReport(gates, 'abc', '2');
    expect(failures).toContain('unit-tests: missing gate.json');
    expect(report.status).toBe('FAIL');
    expect(report.status).not.toBe('PASS');
  });

  it('fails closed when the job attempt list cannot be read', async () => {
    const fetchImpl = async (url) => {
      if (url.includes('/artifacts?')) return jsonResponse({ artifacts: [] });
      if (url.includes('/jobs?')) return jsonResponse({}, 500);
      throw new Error(url);
    };
    await expect(
      collectGateReceipts({
        fetchImpl,
        repo: 'joaobispo2077/maxframe',
        token: 'token',
        runId: '99',
        destDir: mkdtempSync(join(tmpdir(), 'gate-jobs-')),
        attempt: '2',
        jobs: ['lint'],
      }),
    ).rejects.toThrow('job attempt list failed: 500');
  });
});

describe('scheduled workflow warning', () => {
  it('warns when the cron workflow is disabled and stays quiet when active', async () => {
    expect(warningForWorkflowState('active')).toBeNull();
    expect(warningForWorkflowState('disabled_inactivity')).toMatch(/disabled/);
    const disabled = await checkScheduledWorkflow({
      repo: 'joaobispo2077/maxframe',
      token: 'token',
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ state: 'disabled_inactivity' }),
      }),
    });
    expect(disabled.warning).toMatch(/disabled_inactivity/);
    const active = await checkScheduledWorkflow({
      repo: 'joaobispo2077/maxframe',
      token: 'token',
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ state: 'active' }),
      }),
    });
    expect(active.warning).toBeNull();
  });

  it('fails closed when the workflow state cannot be read', async () => {
    await expect(
      checkScheduledWorkflow({
        repo: 'joaobispo2077/maxframe',
        token: 'token',
        fetchImpl: async () => ({
          ok: false,
          status: 403,
          json: async () => ({}),
        }),
      }),
    ).rejects.toThrow(/403/);
  });
});

describe('stryker cache score', () => {
  it('counts a score only for an exact key and drops a prefix restore', () => {
    const exact = decideStrykerCache({
      cacheHit: 'true',
      matchedKey: 'exact',
      incrementalText: '{"marker":"STALE_PREFIX_SCORE_73.37"}',
    });
    expect(exact.exact).toBe(true);
    expect(exact.scoreCountedFromCache).toBe(true);
    expect(exact.incrementalFileRemoved).toBe(false);

    const dir = mkdtempSync(join(tmpdir(), 'stryker-cache-'));
    const incremental = join(dir, 'stryker-incremental.pr.json');
    const decisionFile = join(dir, 'stryker-cache.json');
    writeFileSync(incremental, '{"marker":"STALE_PREFIX_SCORE_73.37"}\n');
    const decision = applyStrykerCacheDecision({
      cacheHit: 'false',
      matchedKey: 'stryker-incremental-pr-Linux-stale',
      incrementalFile: incremental,
      decisionFile,
    });
    expect(decision.scoreCountedFromCache).toBe(false);
    expect(decision.incrementalFileRemoved).toBe(true);
    const summary = buildMutationSummary({
      report: null,
      cacheDecision: decision,
    });
    expect(
      assertPrefixRestoreHasNoScore(summary, decision, {
        exactKey: 'exact-miss',
      }),
    ).toEqual([]);
    expect(summary).not.toContain('STALE_PREFIX_SCORE_73.37');
    expect(summary).not.toMatch(/Mutation score:/);
  });
});
