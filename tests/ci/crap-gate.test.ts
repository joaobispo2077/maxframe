import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  CRAP_EVIDENCE_PATH,
  crapEvidence,
  evaluateCrapTop,
  rankFunctions,
  roundCrap,
} from '../../scripts/ci/check-crap.mjs';
import {
  buildQualityRows,
  evidenceForJob,
  sha256File,
} from '../../scripts/ci/gate-metrics.mjs';
import {
  CRAP_MAX_SCORE,
  CRAP_OVER_30_MAX,
  crapTopFloorLabel,
} from '../../scripts/ci/quality-floors.mjs';
import { crapTopSection } from '../../scripts/ci/render-quality-report.mjs';
import {
  buildGateReceipt,
  stageHashedEvidence,
  writeGateReceipt,
} from '../../scripts/ci/write-gate-json.mjs';

const root = resolve(import.meta.dirname, '../..');

function measured(functions, extra = {}) {
  return {
    functions,
    coveragePresent: true,
    parseErrors: [],
    ...extra,
  };
}

function fn(
  name: string,
  crap: number,
  complexity = 6,
  coveragePct: number | null = 0,
  file = 'src/a.ts',
) {
  return { file, name, line: 1, complexity, coveragePct, crap };
}

function hotSource(branches: number) {
  const lines = ['export function hot(value: number): number {'];
  for (let index = 0; index < branches; index += 1) {
    lines.push(`  if (value === ${index}) return ${index};`);
  }
  lines.push('  return value;');
  lines.push('}');
  return `${lines.join('\n')}\n`;
}

function runScript(options: {
  coverage?: string | 'missing';
  source?: string;
}) {
  const dir = mkdtempSync(join(root, 'reports/quality/crap-gate-'));
  const coveragePath = join(dir, 'coverage-final.json');
  const resultPath = join(dir, 'crap-result.json');
  const evidencePath = join(dir, 'crap.json');
  const scanRoot = join(dir, 'scan');
  mkdirSync(join(scanRoot, 'src'), { recursive: true });
  writeFileSync(
    join(scanRoot, 'src', 'hot.ts'),
    options.source ?? 'export const label = "plain";\n',
  );
  if (options.coverage !== 'missing') {
    writeFileSync(
      coveragePath,
      options.coverage ??
        `${JSON.stringify({ '/virtual/unrelated.ts': { statementMap: {}, s: {} } })}\n`,
    );
  }
  const result = spawnSync(process.execPath, ['scripts/ci/check-crap.mjs'], {
    cwd: root,
    env: {
      ...process.env,
      CRAP_ROOT: scanRoot,
      CRAP_EVIDENCE: evidencePath,
      GATE_COVERAGE_FINAL:
        options.coverage === 'missing'
          ? join(dir, 'absent.json')
          : coveragePath,
      GATE_RESULT: resultPath,
    },
    encoding: 'utf8',
  });
  const written = JSON.parse(readFileSync(resultPath, 'utf8')) as {
    status: string;
    value: string;
    floor: string;
    evidenceSha256?: string | null;
    evidencePath?: string | null;
    metrics: {
      worst: number;
      above: number;
      top10: Array<{ file: string; name: string; crap: number }>;
    } | null;
  };
  return { result, written, evidencePath, resultPath, dir };
}

describe('CRAP top 10 gate', () => {
  it('locks the measured develop ceilings', () => {
    expect(CRAP_MAX_SCORE).toBe(72);
    expect(CRAP_OVER_30_MAX).toBe(3);
    expect(crapTopFloorLabel()).toBe(
      `worst <= ${CRAP_MAX_SCORE}, above 30 <= ${CRAP_OVER_30_MAX}`,
    );
    expect(roundCrap(156.004)).toBe(156);
    expect(roundCrap(156.005)).toBe(156.01);
  });

  it('fails when the worst score or the count above 30 exceeds the ceiling', () => {
    const aboveAtCeiling = CRAP_MAX_SCORE > 30 ? 1 : 0;
    const onScore = evaluateCrapTop(measured([fn('top', CRAP_MAX_SCORE, 12)]));
    expect(onScore.status).toBe('PASS');
    expect(onScore.value).toBe(
      `worst ${CRAP_MAX_SCORE.toFixed(2)}, ${aboveAtCeiling} above 30`,
    );
    expect(onScore.floor).toBe(
      `worst <= ${CRAP_MAX_SCORE}, above 30 <= ${CRAP_OVER_30_MAX}`,
    );

    const bumped = roundCrap(CRAP_MAX_SCORE + 0.01) ?? CRAP_MAX_SCORE + 0.01;
    const overScore = evaluateCrapTop(measured([fn('hot', bumped, 13)]));
    expect(overScore.status).toBe('FAIL');
    expect(overScore.status).not.toBe('PASS');
    expect(overScore.value).toContain(
      `worst ${bumped.toFixed(2)} is above ${CRAP_MAX_SCORE}`,
    );

    const overCount = Array.from({ length: CRAP_OVER_30_MAX + 1 }, (_, i) =>
      fn(`fn${i}`, 42, 6, 0, `src/f${i}.ts`),
    );
    const counted = evaluateCrapTop(measured(overCount));
    expect(counted.status).toBe('FAIL');
    expect(counted.status).not.toBe('PASS');
    expect(counted.value).toContain(
      `${CRAP_OVER_30_MAX + 1} above 30 is above ${CRAP_OVER_30_MAX}`,
    );
    expect(counted.metrics?.top10).toHaveLength(
      Math.min(10, CRAP_OVER_30_MAX + 1),
    );

    const exact = evaluateCrapTop(measured([fn('edge', 30, 5)]));
    expect(exact.status).toBe('PASS');
    expect(exact.metrics?.above).toBe(0);
    expect(exact.value).toBe('worst 30.00, 0 above 30');
  });

  it('fails closed when coverage is unreadable or no function is measured', () => {
    expect(
      evaluateCrapTop({
        functions: [],
        coveragePresent: false,
        parseErrors: [],
      }).status,
    ).toBe('UNKNOWN');
    expect(evaluateCrapTop(null).status).toBe('UNKNOWN');
    expect(evaluateCrapTop(measured([])).status).toBe('UNKNOWN');

    for (const coverage of ['missing', '{', '[]', '{}'] as const) {
      const { result, written } = runScript({ coverage });
      expect(result.status).not.toBe(0);
      expect(written.status).toBe('UNKNOWN');
      expect(written.status).not.toBe('PASS');
      expect(written.value).toContain('UNKNOWN');
      expect(written.evidenceSha256 ?? null).toBeNull();
    }

    const empty = runScript({
      source: 'export const label = "plain";\n',
    });
    expect(empty.result.status).not.toBe(0);
    expect(empty.written.status).toBe('UNKNOWN');
    expect(empty.written.value).toContain('Counts unavailable');
    expect(empty.written.evidenceSha256 ?? null).toBeNull();

    const missingCoverage = evaluateCrapTop(measured([fn('gap', 12, 3, null)]));
    expect(missingCoverage.status).toBe('UNKNOWN');
    expect(missingCoverage.status).not.toBe('PASS');
    const nonFiniteCrap = evaluateCrapTop(
      measured([fn('gap', Number.NaN, 3, 0)]),
    );
    expect(nonFiniteCrap.status).toBe('UNKNOWN');
    expect(nonFiniteCrap.status).not.toBe('PASS');
    const nonFiniteComplexity = evaluateCrapTop(
      measured([fn('gap', 12, Number.POSITIVE_INFINITY, 0)]),
    );
    expect(nonFiniteComplexity.status).toBe('UNKNOWN');
    expect(nonFiniteComplexity.status).not.toBe('PASS');
  });

  it('hashes the evidence file and not the gate receipt', () => {
    expect(CRAP_EVIDENCE_PATH).toBe(
      join('reports/quality/evidence', 'crap.json'),
    );
    const run = runScript({ source: hotSource(20) });
    expect(run.result.status).not.toBe(0);
    expect(run.written.status).toBe('FAIL');
    expect(run.written.value).toContain(`is above ${CRAP_MAX_SCORE}`);
    const payload = readFileSync(run.evidencePath);
    const digest = createHash('sha256').update(payload).digest('hex');
    expect(run.written.evidenceSha256).toBe(digest);
    expect(run.written.evidencePath).toBe(run.evidencePath);
    const evidence = JSON.parse(payload.toString('utf8')) as {
      functions: Array<{
        file: string;
        name: string;
        complexity: number;
        coverage: number;
        crap: number;
      }>;
    };
    expect(evidence.functions[0]).toEqual({
      file: 'src/hot.ts',
      name: 'hot',
      complexity: evidence.functions[0].complexity,
      coverage: 0,
      crap: evidence.functions[0].crap,
    });
    expect(evidence.functions[0].crap).toBeGreaterThan(CRAP_MAX_SCORE);
    expect(digest).toBe(
      createHash('sha256')
        .update(
          crapEvidence(
            rankFunctions([
              {
                file: 'src/hot.ts',
                name: 'hot',
                line: 1,
                complexity: evidence.functions[0].complexity,
                coveragePct: 0,
                crap: evidence.functions[0].crap,
              },
            ]),
          ),
        )
        .digest('hex'),
    );
    const receiptHash = createHash('sha256')
      .update(JSON.stringify(run.written))
      .digest('hex');
    expect(receiptHash).not.toBe(digest);

    const extra = evidenceForJob('crap', { GATE_RESULT: run.resultPath });
    expect(extra.evidenceSha256).toBe(digest);
    expect(extra.evidencePath).toBe(run.evidencePath);
    const receipt = buildGateReceipt({
      job: 'crap',
      outcome: 'failure',
      sha: 'abc',
      extra,
    });
    const gatesRoot = join(run.dir, 'gates');
    stageHashedEvidence(receipt, extra.evidencePath, gatesRoot);
    writeGateReceipt(receipt, gatesRoot);
    const artifactDir = join(gatesRoot, 'crap');
    const gateBytes = readFileSync(join(artifactDir, 'gate.json'));
    expect(createHash('sha256').update(gateBytes).digest('hex')).not.toBe(
      digest,
    );
    expect(sha256File(join(artifactDir, receipt.evidenceFile))).toBe(digest);
    const row = buildQualityRows({
      needs: { crap: { result: 'failure' } },
      gates: {
        crap: JSON.parse(gateBytes.toString('utf8')),
      },
    }).find((item) => item.job === 'crap');
    expect(row?.gate).toBe('CRAP top 10');
    expect(row?.status).toBe('FAIL');
    expect(row?.evidenceSha256).toBe(digest);
    expect(row?.evidenceSha256).not.toBe(
      createHash('sha256').update(gateBytes).digest('hex'),
    );
    const section = crapTopSection([row]).join('\n');
    expect(section).toContain('<summary>CRAP top 10</summary>');
    expect(section).toContain('src/hot.ts:hot');
    expect(section).toContain('0.00%');
    expect(section).toContain('</details>');
  });
});
