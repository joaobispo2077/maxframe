import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { evaluateArchitecture } from '../../scripts/ci/check-architecture.mjs';
import { evaluateAudit } from '../../scripts/ci/check-audit.mjs';
import {
  REQUIRED_JOBS,
  buildReport,
  gateArtifactName,
  selectNamedArtifact,
} from '../../scripts/ci/check-ci-readiness.mjs';
import {
  evaluateCoverage,
  totalsFromSummary,
} from '../../scripts/ci/check-coverage.mjs';
import {
  evaluateDeadcode,
  flattenKnip,
} from '../../scripts/ci/check-deadcode.mjs';
import { evaluateDuplication } from '../../scripts/ci/check-duplication.mjs';
import { evaluateElectronSecurity } from '../../scripts/ci/check-electron-security.mjs';
import {
  allowKey,
  crapScore,
  evaluateComplexity,
} from '../../scripts/ci/crap.mjs';
import { buildStrykerRow } from '../../scripts/ci/gate-metrics.mjs';
import {
  COVERAGE_FLOORS,
  MUTATION_BREAK,
} from '../../scripts/ci/quality-floors.mjs';
import {
  mutationOverall,
  renderMutationMarkdown,
} from '../../scripts/ci/render-mutation-report.mjs';
import {
  displayOverall,
  renderQualityMarkdown,
} from '../../scripts/ci/render-quality-report.mjs';
import { buildGateReceipt } from '../../scripts/ci/write-gate-json.mjs';

function summary(pct) {
  const item = { pct, covered: pct, total: 100 };
  return {
    total: {
      statements: item,
      branches: item,
      functions: item,
      lines: item,
    },
  };
}

describe('coverage gate', () => {
  it('returns UNKNOWN when the summary is missing', () => {
    const result = evaluateCoverage(null);
    expect(result.status).toBe('UNKNOWN');
    expect(result.value).toContain('UNKNOWN');
    expect(result.status).not.toBe('PASS');
    expect(totalsFromSummary(null)).toBeNull();
  });

  it('returns FAIL when a metric is below its floor', () => {
    const totals = totalsFromSummary(summary(90));
    totals.lines.pct = COVERAGE_FLOORS.lines - 0.1;
    const result = evaluateCoverage(totals);
    expect(result.status).toBe('FAIL');
    expect(result.value).toContain('lines');
    expect(result.status).not.toBe('PASS');
  });

  it('returns PASS when every metric meets its floor', () => {
    const totals = totalsFromSummary({
      total: {
        statements: { pct: 74, covered: 74, total: 100 },
        branches: { pct: 63, covered: 63, total: 100 },
        functions: { pct: 81, covered: 81, total: 100 },
        lines: { pct: 75, covered: 75, total: 100 },
      },
    });
    expect(evaluateCoverage(totals).status).toBe('PASS');
  });
});

describe('other blocking gates', () => {
  it('fails duplication above the ceiling and passes on the ceiling', () => {
    const over = evaluateDuplication({
      statistics: {
        total: { percentage: 2.1, duplicatedLines: 21, lines: 1000 },
      },
    });
    expect(over.status).toBe('FAIL');
    const onLine = evaluateDuplication({
      statistics: {
        total: { percentage: 2, duplicatedLines: 20, lines: 1000 },
      },
    });
    expect(onLine.status).toBe('PASS');
    expect(evaluateDuplication(null).status).toBe('UNKNOWN');
  });

  it('fails unwaived dead code and passes an allowlisted set', () => {
    const report = {
      issues: [
        {
          file: 'src/a.ts',
          files: [{ name: 'src/a.ts' }],
        },
      ],
    };
    const findings = flattenKnip(report);
    expect(evaluateDeadcode(null, new Set()).status).toBe('UNKNOWN');
    expect(evaluateDeadcode(findings, new Set()).status).toBe('FAIL');
    expect(evaluateDeadcode(findings, new Set(findings)).status).toBe('PASS');
  });

  it('fails architecture violations and missing summaries', () => {
    expect(evaluateArchitecture({}).status).toBe('UNKNOWN');
    expect(
      evaluateArchitecture({ summary: { error: 1 }, modules: [] }).status,
    ).toBe('FAIL');
    expect(
      evaluateArchitecture({ summary: { error: 0 }, modules: [] }).status,
    ).toBe('PASS');
  });

  it('fails when high or critical audit findings rise above the measured ceiling', () => {
    expect(evaluateAudit({}).status).toBe('UNKNOWN');
    expect(
      evaluateAudit({
        metadata: {
          vulnerabilities: { high: 40, critical: 2, moderate: 1, low: 0 },
        },
      }).status,
    ).toBe('PASS');
    const over = evaluateAudit({
      metadata: { vulnerabilities: { high: 41, critical: 2 } },
    });
    expect(over.status).toBe('FAIL');
    expect(over.value).toContain('above');
  });

  it('fails Electron windows that are not sandboxed', () => {
    const bad = evaluateElectronSecurity([
      {
        path: 'packages/main/src/modules/WindowManager.ts',
        text: 'new BrowserWindow({ webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: false } })',
      },
    ]);
    expect(bad.status).toBe('FAIL');
    expect(bad.value).toContain('sandbox');
    const good = evaluateElectronSecurity([
      {
        path: 'packages/main/src/modules/WindowManager.ts',
        text: 'new BrowserWindow({ webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } })',
      },
    ]);
    expect(good.status).toBe('PASS');
    expect(evaluateElectronSecurity([]).status).toBe('UNKNOWN');
  });

  it('fails a new function over the CRAP line and passes an allowlisted one', () => {
    const item = {
      file: 'src/a.ts',
      name: 'hot',
      line: 4,
      complexity: 8,
      coveragePct: 0,
      crap: crapScore(8, 0),
    };
    const measurement = {
      functions: [item],
      parseErrors: [],
      coveragePresent: true,
    };
    expect(evaluateComplexity(measurement, new Set()).status).toBe('FAIL');
    expect(
      evaluateComplexity(measurement, new Set([allowKey(item)])).status,
    ).toBe('PASS');
    expect(
      evaluateComplexity(
        { functions: [], parseErrors: [], coveragePresent: false },
        new Set(),
      ).status,
    ).toBe('UNKNOWN');
  });
});

describe('mutation sticky and attempt artifacts', () => {
  it('returns UNKNOWN when the mutation summary is missing and FAIL below the floor', () => {
    const missing = buildStrykerRow({ metrics: null, jobResult: 'success' });
    expect(missing.status).toBe('UNKNOWN');
    expect(missing.mode).toBe('BLOCK');
    const low = buildStrykerRow({
      metrics: {
        profile: 'incremental',
        killed: 1,
        survived: 9,
        timeout: 0,
        noCoverage: 0,
        scored: 10,
        detectedScore: MUTATION_BREAK - 1,
        killedOnlyScore: MUTATION_BREAK - 1,
        timeoutPct: 0,
        timeoutAbove2: false,
        zeroMutants: false,
        countsUnknown: false,
        tested: 10,
        cached: 0,
      },
      jobResult: 'failure',
    });
    expect(low.status).toBe('FAIL');
    expect(low.floor).toBe(`break ${MUTATION_BREAK}`);
  });

  it('picks the artifact from the current attempt and ignores a stale one', () => {
    const artifacts = [
      {
        name: 'gate-lint-attempt-1',
        expired: false,
        updated_at: '2026-10-01T00:00:00Z',
        id: 1,
      },
      {
        name: 'gate-lint-attempt-2',
        expired: false,
        updated_at: '2026-10-02T00:00:00Z',
        id: 2,
      },
      {
        name: 'gate-lint',
        expired: false,
        updated_at: '2026-10-03T00:00:00Z',
        id: 3,
      },
    ];
    expect(gateArtifactName('lint', '2')).toBe('gate-lint-attempt-2');
    expect(
      selectNamedArtifact(artifacts, gateArtifactName('lint', '2')).id,
    ).toBe(2);
    expect(
      selectNamedArtifact(artifacts, gateArtifactName('lint', '3')),
    ).toBeNull();
  });

  it('keeps the chart overall equal to the software metrics overall', () => {
    const needs = Object.fromEntries(
      REQUIRED_JOBS.map((job) => [job, { result: 'success' }]),
    );
    const gates = Object.fromEntries(
      REQUIRED_JOBS.map((job) => [
        job,
        buildGateReceipt({
          job,
          outcome: 'success',
          sha: 'abc',
          extra:
            job === 'mutation-tests'
              ? {
                  value: 'score',
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
                    tested: 4,
                    cached: 6,
                  },
                  survivors: [{ file: 'src/a.ts', survived: 2 }],
                  mutationScope: {
                    scopeLabel: 'changed files: src/a.ts',
                  },
                }
              : { value: `${job} ok`, metrics: { lines: 80, percent: 1 } },
        }),
      ]),
    );
    const report = buildReport({
      needs,
      gates,
      failures: [],
      env: { GITHUB_SHA: 'abc', GITHUB_RUN_ATTEMPT: '2' },
    });
    const markdown = renderQualityMarkdown(report);
    expect(displayOverall(report)).toBe('PASS');
    expect(markdown).toContain('## Software metrics');
    expect(markdown).toContain('| Gate | Value | Floor | Result |');
    expect(markdown).toContain('<!-- chart-overall:PASS -->');
    expect(
      markdown.match(/<!-- chart-overall:(PASS|FAIL|UNKNOWN) -->/)[1],
    ).toBe(displayOverall(report));
    const mutation = renderMutationMarkdown(report, {
      htmlReportUrl: 'https://github.com/example/actions/runs/1/artifacts/2',
    });
    expect(mutationOverall(report)).toBe('PASS');
    expect(mutation).toContain('## Mutation tests');
    expect(mutation).toContain('changed files: src/a.ts');
    expect(mutation).toContain('src/a.ts');
    expect(mutation).toContain('HTML report artifact');
    expect(mutation).toContain('<!-- chart-overall:PASS -->');
  });

  it('renders a missing readiness file as UNKNOWN for both stickies', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sticky-missing-'));
    writeFileSync(join(dir, 'note.txt'), 'x');
    const software = renderQualityMarkdown(null);
    const mutation = renderMutationMarkdown(null);
    expect(software).toContain('Overall: UNKNOWN');
    expect(software).toContain('<!-- chart-overall:UNKNOWN -->');
    expect(mutation).toContain('Overall: UNKNOWN');
    expect(mutation).not.toContain('Overall: PASS');
    expect(readFileSync(join(dir, 'note.txt'), 'utf8')).toBe('x');
  });
});
