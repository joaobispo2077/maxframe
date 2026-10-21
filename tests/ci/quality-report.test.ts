import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
  renderQualityMarkdown,
  renderQualityReportFile,
  renderQualityReportText,
} from '../../scripts/ci/render-quality-report.mjs';
import {
  buildGateReceipt,
  publishGateLog,
} from '../../scripts/ci/write-gate-json.mjs';

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
        extra: { value: `${job} ok`, floor: 'floor' },
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

  it('renders FAIL when an INFO row was marked PASS', () => {
    const report = passingReport();
    const coverage = report.rows.find((row) => row.job === 'coverage');
    coverage.status = 'PASS';
    expect(displayOverall(report)).toBe('FAIL');
    expect(renderQualityMarkdown(report)).not.toContain('Overall: PASS');
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
  it('prints every coverage percentage against no threshold', () => {
    const totals = readCoverageTotals({
      total: {
        lines: { pct: 80, covered: 8, total: 10 },
        statements: { pct: 81.2, covered: 81, total: 100 },
        branches: { pct: 70, covered: 7, total: 10 },
        functions: { pct: 75, covered: 3, total: 4 },
      },
    });
    const value = formatCoverageValue(totals);
    expect(value).toContain('lines 80.00% (8/10) vs threshold none');
    expect(value).toContain('statements 81.20% (81/100) vs threshold none');
    expect(value).toContain('branches 70.00% (7/10) vs threshold none');
    expect(value).toContain('functions 75.00% (3/4) vs threshold none');
    const rows = buildQualityRows({
      needs: successfulNeeds(),
      gates: {
        'unit-tests': {
          status: 'PASS',
          coverage: { value, evidenceSha256: 'abc' },
        },
      },
    });
    const coverage = rows.find((row) => row.job === 'coverage');
    expect(coverage.mode).toBe('INFO');
    expect(coverage.status).toBe('INFO');
    expect(coverage.status).not.toBe('PASS');
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
    expect(row.mode).toBe('INFO');
    expect(row.status).toBe('INFO');
    expect(row.value).toContain('cached, not a floor sample');
    expect(row.value).toContain('0 tested this run');
    expect(row.value).toContain('1264 cached');
    expect(row.value).toContain(
      'Cached score with timeouts as detected: 69.86%',
    );
    expect(row.value).toContain('Killed only: 68.51%');
    expect(row.value).not.toContain('Timeouts above 2%');
    expect(row.status).not.toBe('PASS');
  });

  it('does not turn zero mutants into 100 percent', () => {
    const metrics = mutationMetrics({
      report: mutationReport({}),
      profile: 'incremental',
      cacheDecision: { exact: true },
    });
    const row = buildStrykerRow({ metrics, jobResult: 'success' });
    expect(row.status).toBe('INFO');
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
    expect(row.status).toBe('INFO');
    expect(row.value).toContain('Timeouts above 2%');
    expect(row.value).toContain('100 tested this run');
    expect(row.value).not.toContain('cached, not a floor sample');
  });

  it('leaves an unmeasured INFO gate as UNKNOWN and not blank', () => {
    const rows = buildQualityRows({
      needs: successfulNeeds(),
      gates: passingGates(),
    });
    for (const job of ['crap', 'jscpd', 'knip', 'dependency-cruiser']) {
      const row = rows.find((item) => item.job === job);
      expect(row.mode).toBe('INFO');
      expect(row.status).toBe('UNKNOWN');
      expect(row.value.trim().length).toBeGreaterThan(0);
      expect(row.status).not.toBe('PASS');
    }
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
            'lines 80.00% (8/10) vs threshold none',
          ],
        },
        { GITHUB_STEP_SUMMARY: summary },
      );
    } finally {
      process.stdout.write = original;
    }
    const logged = lines.join('');
    expect(logged).toContain('lines 80.00% (8/10) vs threshold none');
    expect(readFileSync(summary, 'utf8')).toContain(
      'lines 80.00% (8/10) vs threshold none',
    );
  });
});
