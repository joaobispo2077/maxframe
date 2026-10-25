import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  REQUIRED_JOBS,
  buildReport,
} from '../../scripts/ci/check-ci-readiness.mjs';
import {
  BLOCK_GATES,
  NOT_WIRED_GATES,
  buildQualityRows,
  buildStrykerRow,
  formatCoverageValue,
  formatEslintMessages,
  lintBaselineFailures,
  mutationMetrics,
  parseReuseLine,
  parseSizeLimit,
  readCoverageTotals,
  readEslintCounts,
  sha256Text,
} from '../../scripts/ci/gate-metrics.mjs';
import {
  mutationOverall,
  mutationReportExitCode,
  renderMutationMarkdown,
} from '../../scripts/ci/render-mutation-report.mjs';
import {
  displayOverall,
  evidenceClass,
  evidenceCompletenessLine,
  qualityReportExitCode,
  renderQualityMarkdown,
  renderQualityReportFile,
  renderQualityReportText,
} from '../../scripts/ci/render-quality-report.mjs';
import {
  buildGateReceipt,
  publishGateLog,
} from '../../scripts/ci/write-gate-json.mjs';

const root = resolve(import.meta.dirname, '../..');

function mutants(status, count) {
  return Array.from({ length: count }, () => ({ status }));
}

function mutationReport(counts) {
  return {
    files: {
      'src/a.ts': {
        mutants: [
          ...mutants('Killed', counts.killed ?? 0),
          ...mutants('Timeout', counts.timeout ?? 0),
          ...mutants('Survived', counts.survived ?? 0),
          ...mutants('NoCoverage', counts.noCoverage ?? 0),
        ],
      },
    },
  };
}

function successfulNeeds() {
  return Object.fromEntries(
    REQUIRED_JOBS.map((job) => [job, { result: 'success' }]),
  );
}

function changedSourceScope() {
  return {
    mode: 'changed-files',
    mutableSourceChanged: true,
    changedFiles: ['src/a.ts'],
    scopeLabel: 'changed files: src/a.ts',
  };
}

function passingMutationExtra() {
  return {
    value: 'mutation ok',
    floor: 'break 68',
    stryker: mutationMetrics({
      report: mutationReport({
        killed: 8,
        timeout: 1,
        survived: 1,
        noCoverage: 0,
      }),
      logText: 'Result: 6 of 10 mutant result(s) are reused.',
      profile: 'incremental',
      cacheDecision: { exact: true },
    }),
    mutationScope: changedSourceScope(),
  };
}

function passingGates() {
  return Object.fromEntries(
    REQUIRED_JOBS.map((job) => [
      job,
      buildGateReceipt({
        job,
        outcome: 'success',
        sha: 'abc',
        runId: '9',
        runAttempt: '2',
        extra:
          job === 'mutation-tests'
            ? passingMutationExtra()
            : { value: `${job} ok`, floor: 'floor' },
      }),
    ]),
  );
}

function passingReport() {
  const gates = passingGates();
  gates['unit-tests'].coverage = {
    value:
      'lines 80.00% (8/10) vs threshold none; statements 80.00% (8/10) vs threshold none; branches 70.00% (7/10) vs threshold none; functions 75.00% (3/4) vs threshold none',
    evidenceSha256: 'coveragehash',
  };
  gates['mutation-tests'].stryker = mutationMetrics({
    report: mutationReport({
      killed: 8,
      timeout: 1,
      survived: 1,
      noCoverage: 0,
    }),
    logText: 'Result: 6 of 10 mutant result(s) are reused.',
    profile: 'incremental',
    cacheDecision: { exact: true },
  });
  return buildReport({
    needs: successfulNeeds(),
    gates,
    failures: [],
    env: {
      GITHUB_SHA: 'abc',
      GITHUB_RUN_ID: '9',
      GITHUB_RUN_ATTEMPT: '2',
      GITHUB_REPOSITORY: 'joaobispo2077/maxframe',
    },
  });
}

describe('quality report fail closed', () => {
  it('renders UNKNOWN when ci-readiness.json is missing and never PASS', () => {
    const missing = renderQualityReportFile(
      join(tmpdir(), 'no-such-ci-readiness.json'),
    );
    expect(missing.overall).toBe('UNKNOWN');
    expect(missing.markdown).toContain('Overall: UNKNOWN');
    expect(missing.markdown).not.toContain('Overall: PASS');
    expect(missing.markdown).toContain('missing');
  });

  it('renders UNKNOWN when ci-readiness.json is unparsable and never PASS', () => {
    const broken = renderQualityReportText('{');
    expect(broken.overall).toBe('UNKNOWN');
    expect(broken.markdown).toContain('Overall: UNKNOWN');
    expect(broken.markdown).not.toContain('Overall: PASS');
  });

  it('renders FAIL when a PASS report is missing an expected gate', () => {
    const report = passingReport();
    report.jobs.lint.gate = null;
    expect(report.status).toBe('PASS');
    expect(displayOverall(report)).toBe('FAIL');
    const markdown = renderQualityMarkdown(report, { artifactSha256: 'abc' });
    expect(markdown).toContain('Overall: FAIL');
    expect(markdown).not.toContain('Overall: PASS');
  });

  it('renders FAIL when a blocking row is not PASS', () => {
    const report = passingReport();
    const coverage = report.rows.find((row) => row.job === 'coverage');
    coverage.status = 'FAIL';
    coverage.value = 'Coverage: FAIL. lines 10.00%';
    expect(displayOverall(report)).toBe('FAIL');
    const failed = renderQualityMarkdown(report);
    expect(failed).not.toContain('**Overall: PASS**');
    expect(failed).toContain('pie showData');
    expect(failed).toContain('"FAIL" : 1');
    expect(failed).not.toContain('](charts/');
  });

  it('keeps overall equal to a complete CI readiness conclusion', () => {
    const report = passingReport();
    expect(report.status).toBe('PASS');
    expect(displayOverall(report)).toBe(report.status);
    const text = `${JSON.stringify(report, null, 2)}\n`;
    const rendered = renderQualityReportText(text);
    expect(rendered.overall).toBe('PASS');
    expect(rendered.markdown).toContain('Overall: PASS');
    expect(rendered.markdown).toContain(
      `ci-readiness.json SHA-256: \`${sha256Text(text)}\``,
    );
    expect(rendered.markdown).toContain('Commit: `abc`');
    expect(rendered.markdown).toContain('Attempt 2.');
    expect(qualityReportExitCode(rendered.overall)).toBe(0);
  });

  it('marks a BLOCK row UNKNOWN when counts are missing and fails the verdict', () => {
    const gates = passingGates();
    gates['e2e-tests'] = buildGateReceipt({
      job: 'e2e-tests',
      outcome: 'success',
      sha: 'abc',
      extra: { value: null },
    });
    gates.format = buildGateReceipt({
      job: 'format',
      outcome: 'success',
      sha: 'abc',
      extra: { value: 'format file count unavailable' },
    });
    gates.lint = buildGateReceipt({
      job: 'lint',
      outcome: 'success',
      sha: 'abc',
      extra: { value: '   ' },
    });
    const report = buildReport({
      needs: successfulNeeds(),
      gates,
      failures: [],
      env: { GITHUB_SHA: 'abc' },
    });
    for (const job of ['e2e-tests', 'format', 'lint']) {
      const row = report.rows.find((item) => item.job === job);
      expect(row.mode).toBe('BLOCK');
      expect(row.status).toBe('UNKNOWN');
      expect(row.value).toContain('UNKNOWN');
      expect(row.value).not.toContain('PASS');
    }
    expect(report.status).toBe('UNKNOWN');
    expect(report.result).not.toBe('success');
    expect(displayOverall(report)).toBe('UNKNOWN');
    expect(qualityReportExitCode(displayOverall(report))).toBe(1);
    const markdown = renderQualityMarkdown(report);
    expect(markdown).toContain('Overall: UNKNOWN');
    expect(markdown).toContain('This is not a pass.');
    expect(markdown).not.toContain('Overall: PASS');
    expect(markdown).not.toContain('ci-readiness.json is unreadable');
  });

  it('keeps overall PASS when mutation is INFO because no mutable source changed', () => {
    const gates = passingGates();
    gates['mutation-tests'] = buildGateReceipt({
      job: 'mutation-tests',
      outcome: 'success',
      sha: 'abc',
      runId: '9',
      runAttempt: '2',
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
    const report = buildReport({
      needs: successfulNeeds(),
      gates,
      failures: [],
      env: { GITHUB_SHA: 'abc' },
    });
    const mutation = report.rows.find((row) => row.job === 'mutation-tests');
    expect(mutation.status).toBe('INFO');
    expect(mutation.mode).toBe('INFO');
    expect(report.status).toBe('PASS');
    expect(displayOverall(report)).toBe('PASS');
    expect(qualityReportExitCode(displayOverall(report))).toBe(0);
    const sticky = renderMutationMarkdown(report);
    expect(mutationOverall(report)).toBe('INFO');
    expect(mutationReportExitCode('INFO')).toBe(0);
    expect(
      sticky.startsWith(
        '<img src="https://raw.githubusercontent.com/joaobispo2077/avo/main/.github/bot-avatars/quality-gate-devsecops.png"',
      ),
    ).toBe(true);
    expect(sticky).toContain('**Quality Gate DevSecOps** (Young Zangetsu)');
    expect(sticky).toContain('no mutable source changed.');
    expect(sticky).toContain('<!-- chart-overall:INFO -->');
    expect(sticky).not.toContain('This is not a pass.');
  });

  it('keeps a complete blocking report at exit 0', () => {
    expect(qualityReportExitCode('PASS')).toBe(0);
    expect(qualityReportExitCode('UNKNOWN')).toBe(1);
    expect(qualityReportExitCode('FAIL')).toBe(1);
    const report = passingReport();
    expect(report.rows.some((row) => row.mode === 'INFO')).toBe(false);
    expect(report.rows.every((row) => row.mode === 'BLOCK')).toBe(true);
    expect(report.rows.every((row) => row.status === 'PASS')).toBe(true);
    expect(displayOverall(report)).toBe('PASS');
    expect(qualityReportExitCode(displayOverall(report))).toBe(0);
  });

  it('names a skipped BLOCK job as FAIL', () => {
    const needs = successfulNeeds();
    needs.format = { result: 'skipped' };
    const rows = buildQualityRows({
      needs,
      gates: passingGates(),
      runUrl: 'https://example.test/run',
    });
    const format = rows.find((row) => row.job === 'format');
    expect(format.status).toBe('FAIL');
    expect(format.value).toBe(
      'Format: FAIL. Skipped, no evidence from this run.',
    );
    const report = buildReport({
      needs,
      gates: passingGates(),
      failures: ['format: expected success, received "skipped"'],
      env: { GITHUB_SHA: 'abc', GITHUB_RUN_ATTEMPT: '1' },
    });
    expect(report.status).toBe('FAIL');
    expect(displayOverall(report)).toBe('FAIL');
  });
});

describe('coverage and stryker rows', () => {
  it('prints every coverage percentage against the vitest floors', () => {
    const totals = readCoverageTotals({
      total: {
        lines: { pct: 80, covered: 8, total: 10 },
        statements: { pct: 81.2, covered: 81, total: 100 },
        branches: { pct: 70, covered: 7, total: 10 },
        functions: { pct: 75, covered: 3, total: 4 },
      },
    });
    const value = formatCoverageValue(totals);
    expect(value).toContain('lines 80.00% (8/10) vs threshold 75');
    expect(value).toContain('statements 81.20% (81/100) vs threshold 74');
    expect(value).toContain('branches 70.00% (7/10) vs threshold 63');
    expect(value).toContain('functions 75.00% (3/4) vs threshold 81');
    const rows = buildQualityRows({
      needs: successfulNeeds(),
      gates: {
        coverage: {
          status: 'PASS',
          value,
          floor: 'statements 74, branches 63, functions 81, lines 75',
          evidenceSha256: 'abc',
        },
      },
    });
    const coverage = rows.find((row) => row.job === 'coverage');
    expect(coverage.mode).toBe('BLOCK');
    expect(coverage.status).toBe('PASS');
    expect(coverage.value).toBe(value);
  });

  it('returns FAIL when mutated source changed and the score is only from cache', () => {
    const log = 'Result:\u001b[33m\t1264 of 1365 mutant result(s) are reused.';
    expect(parseReuseLine(log)).toEqual({ reused: 1264, universe: 1365 });
    const metrics = mutationMetrics({
      report: mutationReport({
        killed: 866,
        timeout: 17,
        survived: 293,
        noCoverage: 88,
      }),
      logText: log,
      profile: 'incremental',
      cacheDecision: { exact: true },
    });
    expect(metrics.tested).toBe(0);
    expect(metrics.cached).toBe(1264);
    expect(metrics.detectedScore.toFixed(2)).toBe('69.86');
    expect(metrics.killedOnlyScore.toFixed(2)).toBe('68.51');
    const row = buildStrykerRow({
      metrics,
      jobResult: 'success',
      mutationScope: changedSourceScope(),
    });
    expect(row.mode).toBe('BLOCK');
    expect(row.status).toBe('FAIL');
    expect(row.status).not.toBe('PASS');
    expect(row.status).not.toBe('INFO');
    expect(row.value).toBe(
      'Mutation: FAIL. Mutable source changed, but 0 mutants tested this run. Score is cache-only. 0 tested this run, 1264 cached.',
    );
    expect(row.floor).toContain('68');
  });

  it('returns INFO only when the mutate-set diff shows no source change', () => {
    const row = buildStrykerRow({
      metrics: null,
      jobResult: 'success',
      mutationScope: {
        mutableSourceChanged: false,
        scopeLabel: 'No mutable source changed.',
      },
    });
    expect(row.mode).toBe('INFO');
    expect(row.status).toBe('INFO');
    expect(row.value).toBe('Mutation: INFO. no mutable source changed.');
  });

  it('returns FAIL when the mutate-set diff is unavailable', () => {
    const missing = buildStrykerRow({
      metrics: {
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
      jobResult: 'success',
      mutationScope: null,
    });
    expect(missing.status).toBe('FAIL');
    expect(missing.status).not.toBe('INFO');
    expect(missing.value).toBe(
      'Mutation: FAIL. Diff against the mutate set is unavailable.',
    );
    const errored = buildStrykerRow({
      metrics: null,
      jobResult: 'success',
      mutationScope: {
        mutableSourceChanged: null,
        scopeLabel: 'Changed file list unavailable (missing base).',
      },
    });
    expect(errored.status).toBe('FAIL');
    expect(errored.status).not.toBe('INFO');
    expect(errored.value).toBe(
      'Mutation: FAIL. Diff against the mutate set is unavailable.',
    );
  });

  it('does not turn zero mutants into 100 percent', () => {
    const metrics = mutationMetrics({
      report: mutationReport({}),
      profile: 'incremental',
      cacheDecision: { exact: true },
    });
    const row = buildStrykerRow({
      metrics,
      jobResult: 'success',
      mutationScope: changedSourceScope(),
    });
    expect(row.mode).toBe('BLOCK');
    expect(row.status).toBe('UNKNOWN');
    expect(row.value).toBe('Zero mutants. Efficacy unavailable.');
    expect(row.value).not.toContain('100');
  });

  it('flags timeouts above 2 percent and still refuses PASS', () => {
    const metrics = mutationMetrics({
      report: mutationReport({ killed: 90, timeout: 3, survived: 7 }),
      profile: 'incremental',
      cacheDecision: { exact: false },
    });
    expect(metrics.tested).toBe(100);
    expect(metrics.cached).toBe(0);
    const row = buildStrykerRow({
      metrics,
      jobResult: 'success',
      mutationScope: changedSourceScope(),
    });
    expect(row.status).toBe('PASS');
    expect(row.value).toContain('Timeouts above 2%');
    expect(row.value).toContain('100 tested this run');
  });

  it('leaves a missing blocking summary as UNKNOWN and not PASS', () => {
    const rows = buildQualityRows({
      needs: successfulNeeds(),
      gates: {
        coverage: {
          status: 'UNKNOWN',
          value: 'Coverage: UNKNOWN. Counts unavailable from this run.',
        },
        duplication: null,
      },
    });
    const coverage = rows.find((item) => item.job === 'coverage');
    expect(coverage.mode).toBe('BLOCK');
    expect(coverage.status).toBe('UNKNOWN');
    expect(coverage.value).toContain('UNKNOWN');
    expect(coverage.status).not.toBe('PASS');
    const duplication = rows.find((item) => item.job === 'duplication');
    expect(duplication.status).toBe('FAIL');
    expect(duplication.value).toContain('No gate.json');
  });
});

describe('job numbers', () => {
  it('fails lint when warnings rise above the recorded baseline', () => {
    const report = [{ errorCount: 0, warningCount: 13 }];
    expect(readEslintCounts(report)).toEqual({ errors: 0, warnings: 13 });
    expect(lintBaselineFailures(readEslintCounts(report))).toEqual([]);
    expect(lintBaselineFailures({ errors: 0, warnings: 14 })).toHaveLength(1);
    expect(lintBaselineFailures({ errors: 1, warnings: 13 })).toHaveLength(1);
    expect(
      formatEslintMessages([
        {
          filePath: 'src/a.ts',
          messages: [
            { line: 4, severity: 1, message: 'unused', ruleId: 'no-unused' },
          ],
        },
      ]),
    ).toEqual(['src/a.ts:4 warning unused no-unused']);
  });

  it('keeps size-limit informational and never PASS', () => {
    const parsed = parseSizeLimit(
      'Size limit: 500 kB\nSize:       120 kB\n',
      '0',
    );
    expect(parsed.status).toBe('INFO');
    expect(parsed.value).toContain('120 kB vs threshold 500 kB');
    expect(parsed.status).not.toBe('PASS');
  });

  it('prints coverage lines to stdout and the step summary', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gate-log-'));
    const summary = join(dir, 'summary.md');
    const lines = [];
    const original = process.stdout.write;
    process.stdout.write = (chunk) => {
      lines.push(String(chunk));
      return true;
    };
    try {
      publishGateLog(
        {
          job: 'unit-tests',
          status: 'PASS',
          logLines: [
            'Unit: 2 passed, 0 failed, 0 skipped',
            'Coverage summary',
            'lines 80.00% (8/10) vs threshold 75',
          ],
        },
        { GITHUB_STEP_SUMMARY: summary },
      );
    } finally {
      process.stdout.write = original;
    }
    const logged = lines.join('');
    expect(logged).toContain('lines 80.00% (8/10) vs threshold 75');
    expect(readFileSync(summary, 'utf8')).toContain(
      'lines 80.00% (8/10) vs threshold 75',
    );
  });
});

describe('quality report process exit', () => {
  it('writes the UNKNOWN sticky and then exits non-zero when the report is missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'quality-missing-'));
    const markdownPath = join(dir, 'maxframe-quality.md');
    const result = spawnSync(
      process.execPath,
      ['scripts/ci/render-quality-report.mjs'],
      {
        cwd: root,
        env: {
          ...process.env,
          CI_READINESS_REPORT: join(dir, 'missing-on-purpose.json'),
          QUALITY_REPORT: markdownPath,
        },
        encoding: 'utf8',
      },
    );
    expect(result.status).toBe(1);
    const markdown = readFileSync(markdownPath, 'utf8');
    expect(markdown).toContain('Overall: UNKNOWN');
    expect(markdown).toContain('ci-readiness.json is missing.');
    expect(markdown).not.toContain('Overall: PASS');
    expect(result.stdout).toContain('Overall: UNKNOWN');
  });

  it('exits 0 after writing a PASS sticky when only INFO rows are non-PASS', () => {
    const dir = mkdtempSync(join(tmpdir(), 'quality-pass-'));
    const reportPath = join(dir, 'ci-readiness.json');
    const markdownPath = join(dir, 'maxframe-quality.md');
    const report = passingReport();
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    const result = spawnSync(
      process.execPath,
      ['scripts/ci/render-quality-report.mjs'],
      {
        cwd: root,
        env: {
          ...process.env,
          CI_READINESS_REPORT: reportPath,
          QUALITY_REPORT: markdownPath,
        },
        encoding: 'utf8',
      },
    );
    expect(result.status).toBe(0);
    const markdown = readFileSync(markdownPath, 'utf8');
    expect(markdown).toContain('Overall: PASS');
    expect(result.stdout).toContain('overall PASS');
  });

  it('exits non-zero after writing a FAIL sticky', () => {
    const dir = mkdtempSync(join(tmpdir(), 'quality-fail-'));
    const reportPath = join(dir, 'ci-readiness.json');
    const markdownPath = join(dir, 'maxframe-quality.md');
    const report = passingReport();
    report.status = 'FAIL';
    report.failures = ['format: expected success, received "skipped"'];
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    const result = spawnSync(
      process.execPath,
      ['scripts/ci/render-quality-report.mjs'],
      {
        cwd: root,
        env: {
          ...process.env,
          CI_READINESS_REPORT: reportPath,
          QUALITY_REPORT: markdownPath,
        },
        encoding: 'utf8',
      },
    );
    expect(result.status).toBe(1);
    const markdown = readFileSync(markdownPath, 'utf8');
    expect(markdown).toContain('Overall: FAIL');
    expect(markdown).not.toContain('Overall: PASS');
  });
});

describe('quality report sections', () => {
  const head = 'a'.repeat(40);
  const base = 'b'.repeat(40);
  const artifact =
    'https://github.com/joaobispo2077/maxframe/actions/runs/9/artifacts/44';
  const jobUrl =
    'https://github.com/joaobispo2077/maxframe/actions/runs/9/job/8';

  function rowLine(markdown, gate) {
    return markdown.split('\n').find((line) => line.startsWith(`| ${gate} |`));
  }

  it('lists planned gates as not wired and does not change a passing overall', () => {
    const report = passingReport();
    expect(report.status).toBe('PASS');
    expect(displayOverall(report)).toBe('PASS');
    expect(report.unwired).toHaveLength(NOT_WIRED_GATES.length);
    for (const spec of NOT_WIRED_GATES) {
      expect(REQUIRED_JOBS).not.toContain(spec.job);
      expect(BLOCK_GATES.map((gate) => gate.job)).not.toContain(spec.job);
      expect(report.rows.some((row) => row.job === spec.job)).toBe(false);
    }
    const markdown = renderQualityMarkdown(report);
    expect(markdown).toContain(
      `${REQUIRED_JOBS.length} of ${REQUIRED_JOBS.length + NOT_WIRED_GATES.length} gates wired.`,
    );
    expect(markdown).toContain(
      `All wired gates passed. ${NOT_WIRED_GATES.length} gates not wired yet.`,
    );
    expect(markdown).toContain('Evidence completeness:');
    expect(markdown).toContain('### Executed test evidence');
    expect(markdown).toContain(
      '| Suite | Passed | Failed | Skipped | Result | Evidence |',
    );
    for (const row of report.unwired) {
      expect(row.status).not.toBe('PASS');
      expect(markdown).toContain(
        `${row.gate}: Not wired yet. Does not change Overall.`,
      );
    }
    expect(markdown).toContain('| Dependency tree (npm find-dupes) |');
    expect(markdown).not.toContain(
      'Dependency tree (npm find-dupes): Not wired yet.',
    );
    for (const gate of [
      'Windows build smoke',
      'Bundled binaries',
      'Accessibility (cypress-axe)',
    ]) {
      expect(markdown).toContain(
        `${gate}: Not wired yet. Does not change Overall.`,
      );
    }
    expect(markdown).toContain('**Overall: PASS**');
    expect(qualityReportExitCode(displayOverall(report))).toBe(0);
  });

  it('links each measured row to its artifact and prints the pull request', () => {
    const report = passingReport();
    const digest = 'c'.repeat(64);
    for (const row of report.rows) {
      row.evidenceSha256 = digest;
      row.artifactUrl = artifact;
    }
    report.rows.find((row) => row.job === 'unit-tests').metrics = {
      passed: 394,
      failed: 0,
      skipped: 2,
    };
    report.rows.find((row) => row.job === 'e2e-tests').metrics = {
      passed: 12,
      failed: 0,
      skipped: 1,
    };
    report.pullRequest = {
      number: '53',
      url: 'https://github.com/joaobispo2077/maxframe/pull/53',
      headSha: head,
      baseSha: base,
      baseRef: 'develop',
    };
    const markdown = renderQualityMarkdown(report, { artifactSha256: digest });
    expect(evidenceCompletenessLine(report.rows)).toBe(
      `Evidence completeness: ${report.rows.length} measured, 0 partial, 0 unavailable.`,
    );
    expect(markdown).toContain(
      `Evidence completeness: ${report.rows.length} measured, 0 partial, 0 unavailable.`,
    );
    expect(markdown).toContain(
      'PR: [#53](https://github.com/joaobispo2077/maxframe/pull/53)',
    );
    expect(markdown).toContain(`PR head: \`${head}\``);
    expect(markdown).toContain(`PR base: \`${base}\` (develop)`);
    expect(markdown).toContain('Tested revision: `abc`');
    const unit = rowLine(markdown, 'Unit');
    expect(unit).toContain(`[artifact](${artifact})`);
    expect(unit).toContain('PASS');
    expect(markdown).toContain(`- Unit: [artifact](${artifact}) \`${digest}\``);
    expect(markdown).toContain('| Unit (Vitest) | 394 | 0 | 2 | PASS |');
    expect(markdown).toContain('| E2E (Cypress) | 12 | 0 | 1 | PASS |');
    expect(displayOverall(report)).toBe('PASS');
  });

  it('does not render PASS when the job failed or was skipped', () => {
    const failedNeeds = successfulNeeds();
    failedNeeds.format = { result: 'failure' };
    const failedGates = passingGates();
    failedGates.format = buildGateReceipt({
      job: 'format',
      outcome: 'success',
      sha: 'abc',
      extra: {
        value: '0 files',
        floor: '0 files',
        evidenceSha256: 'd'.repeat(64),
      },
    });
    failedGates.format.artifactUrl = artifact;
    expect(failedGates.format.status).toBe('PASS');
    const failed = buildReport({
      needs: failedNeeds,
      gates: failedGates,
      failures: ['format: expected success, received "failure"'],
      env: {
        GITHUB_SHA: 'abc',
        GITHUB_REPOSITORY: 'joaobispo2077/maxframe',
        GITHUB_RUN_ID: '9',
        PR_NUMBER: '80',
        PR_BASE_REF: 'develop',
        PR_BASE_SHA: base,
        PR_HEAD_SHA: head,
      },
      jobUrls: { format: jobUrl },
    });
    expect(failed.status).toBe('FAIL');
    const format = failed.rows.find((row) => row.job === 'format');
    expect(format.status).toBe('FAIL');
    expect(format.artifactUrl).toBe(artifact);
    expect(evidenceClass(format)).toBe('measured');
    const failedMarkdown = renderQualityMarkdown(failed);
    expect(displayOverall(failed)).toBe('FAIL');
    expect(failedMarkdown).toContain('**Overall: FAIL**');
    expect(failedMarkdown).not.toContain('**Overall: PASS**');
    expect(failedMarkdown).not.toContain('All wired gates passed.');
    expect(failedMarkdown).toContain('Failed: Format.');
    const failedLine = rowLine(failedMarkdown, 'Format');
    expect(failedLine).toContain('FAIL');
    expect(failedLine).toContain(`[artifact](${artifact})`);
    expect(failedLine).not.toContain('PASS');

    const skippedNeeds = successfulNeeds();
    skippedNeeds['unit-tests'] = { result: 'skipped' };
    const skippedGates = passingGates();
    skippedGates['unit-tests'].artifactUrl = artifact;
    expect(skippedGates['unit-tests'].status).toBe('PASS');
    const skipped = buildReport({
      needs: skippedNeeds,
      gates: skippedGates,
      failures: ['unit-tests: expected success, received "skipped"'],
      env: { GITHUB_SHA: 'abc' },
      jobUrls: { 'unit-tests': jobUrl },
    });
    const unit = skipped.rows.find((row) => row.job === 'unit-tests');
    expect(unit.status).toBe('FAIL');
    expect(unit.artifactUrl).toBeNull();
    expect(unit.value).toBe('Unit: FAIL. Skipped, no evidence from this run.');
    expect(evidenceClass(unit)).toBe('unavailable');
    const skippedMarkdown = renderQualityMarkdown(skipped);
    const unitLine = rowLine(skippedMarkdown, 'Unit');
    expect(unitLine).toContain('FAIL');
    expect(unitLine).toContain(`[job](${jobUrl})`);
    expect(unitLine).not.toContain(artifact);
    expect(unitLine).not.toContain('PASS');
    expect(skippedMarkdown).not.toContain(artifact);
    expect(skippedMarkdown).toContain(
      '| Unit (Vitest) | unavailable | unavailable | unavailable | FAIL |',
    );
    expect(skippedMarkdown).not.toContain('**Overall: PASS**');
  });

  it('keeps the section headings when the readiness file is missing', () => {
    const missing = renderQualityReportFile(
      join(tmpdir(), 'missing-sections.json'),
    );
    expect(missing.overall).toBe('UNKNOWN');
    expect(missing.markdown).toContain('Gates wired: unavailable.');
    expect(missing.markdown).toContain('Evidence completeness: unavailable.');
    expect(missing.markdown).toContain('PR: unavailable');
    expect(missing.markdown).toContain('PR base: unavailable');
    expect(missing.markdown).toContain('### Executed test evidence');
    expect(missing.markdown).toContain('This is not a pass.');
    expect(missing.markdown).not.toContain('All wired gates passed.');
    expect(missing.markdown).not.toContain('**Overall: PASS**');
    for (const spec of NOT_WIRED_GATES) {
      expect(missing.markdown).toContain(
        `${spec.gate}: Not wired yet. Does not change Overall.`,
      );
    }
  });
});
