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
  displayOverall,
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
            ? { value: 'mutation ok', floor: 'break 68' }
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

  it('labels a fully cached Stryker score as cached and INFO', () => {
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
    const row = buildStrykerRow({ metrics, jobResult: 'success' });
    expect(row.mode).toBe('BLOCK');
    expect(row.status).toBe('PASS');
    expect(row.value).toContain('0 tested this run');
    expect(row.value).toContain('1264 cached');
    expect(row.value).toContain('Score 69.86%');
    expect(row.value).toContain('Killed only 68.51%');
    expect(row.value).not.toContain('Timeouts above 2%');
    expect(row.floor).toContain('68');
  });

  it('does not turn zero mutants into 100 percent', () => {
    const metrics = mutationMetrics({
      report: mutationReport({}),
      profile: 'incremental',
      cacheDecision: { exact: true },
    });
    const row = buildStrykerRow({ metrics, jobResult: 'success' });
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
    const row = buildStrykerRow({ metrics, jobResult: 'success' });
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
