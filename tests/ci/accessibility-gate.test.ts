import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  AXE_EVIDENCE_PATH,
  AXE_RAW_PATH,
  REQUIRED_A11Y_SCREENS,
  accessibilityCounts,
  evaluateAccessibility,
  formatAccessibilityValue,
} from '../../scripts/ci/check-accessibility.mjs';
import {
  A11Y_CRITICAL_MAX,
  A11Y_SERIOUS_MAX,
} from '../../scripts/ci/quality-floors.mjs';

const root = resolve(import.meta.dirname, '../..');

function violation(id: string, impact: string, count: number) {
  const nodes =
    count === 0 ? [] : Array.from({ length: count }, () => ({ impact }));
  return { id, impact, nodes };
}

function report(violations: unknown[] = []) {
  return {
    scans: REQUIRED_A11Y_SCREENS.map((screen) => ({
      screen,
      violations: screen === 'analyze' ? violations : [],
    })),
  };
}

function atCeiling() {
  const violations = [];
  if (A11Y_CRITICAL_MAX > 0) {
    violations.push(violation('image-alt', 'critical', A11Y_CRITICAL_MAX));
  }
  if (A11Y_SERIOUS_MAX > 0) {
    violations.push(violation('color-contrast', 'serious', A11Y_SERIOUS_MAX));
  }
  return report(violations);
}

function runScript(payload: string | 'missing') {
  const dir = mkdtempSync(join(tmpdir(), 'a11y-'));
  const axePath = join(dir, 'axe-raw.json');
  const resultPath = join(dir, 'accessibility.json');
  if (payload !== 'missing') writeFileSync(axePath, payload);
  const result = spawnSync(
    process.execPath,
    ['scripts/ci/check-accessibility.mjs'],
    {
      cwd: root,
      env: {
        ...process.env,
        AXE_JSON: payload === 'missing' ? join(dir, 'absent.json') : axePath,
        GATE_RESULT: resultPath,
      },
      encoding: 'utf8',
    },
  );
  const written = JSON.parse(readFileSync(resultPath, 'utf8')) as {
    status: string;
    value: string;
    floor: string;
    evidenceSha256: string | null;
    evidencePath?: string | null;
    metrics: {
      critical: number;
      serious: number;
      moderate: number;
      minor: number;
    } | null;
  };
  return { result, written };
}

describe('accessibility gate', () => {
  it('counts violation nodes by severity across the renderer screens', () => {
    const counts = accessibilityCounts(
      report([
        violation('image-alt', 'critical', 1),
        violation('color-contrast', 'serious', 2),
        {
          id: 'label',
          impact: 'serious',
          nodes: [{ impact: 'critical' }],
        },
        violation('region', 'moderate', 3),
        violation('heading-order', 'minor', 1),
        { id: 'button-name', impact: 'critical', nodes: [] },
      ]),
    );
    expect(counts).toMatchObject({
      critical: 3,
      serious: 2,
      moderate: 3,
      minor: 1,
    });
    expect(REQUIRED_A11Y_SCREENS).toEqual([
      'analyze',
      'analyze-results',
      'queue',
      'settings',
    ]);
  });

  it('fails above either ceiling and passes on it, under it, and for moderate', () => {
    const floor = `<= ${A11Y_CRITICAL_MAX} critical, <= ${A11Y_SERIOUS_MAX} serious`;
    const onResult = evaluateAccessibility(atCeiling());
    expect(onResult.status).toBe('PASS');
    expect(onResult.floor).toBe(floor);
    expect(onResult.value).toBe(
      formatAccessibilityValue({
        critical: A11Y_CRITICAL_MAX,
        serious: A11Y_SERIOUS_MAX,
        moderate: 0,
        minor: 0,
      }),
    );
    const onPayload = `${JSON.stringify(atCeiling())}\n`;
    const onRun = runScript(onPayload);
    expect(onRun.result.status).toBe(0);
    expect(onRun.written.status).toBe('PASS');
    expect(onRun.result.stdout).not.toContain('FAIL');
    expect(onRun.written.evidenceSha256).toMatch(/^[a-f0-9]{64}$/);

    const under = evaluateAccessibility(
      report([violation('region', 'moderate', 4)]),
    );
    expect(under.status).toBe('PASS');
    expect(under.value).toContain('4 moderate');
    expect(under.value).not.toContain('FAIL');

    const overCritical = report([
      violation('image-alt', 'critical', A11Y_CRITICAL_MAX + 1),
    ]);
    const overCriticalResult = evaluateAccessibility(overCritical);
    expect(overCriticalResult.status).toBe('FAIL');
    expect(overCriticalResult.status).not.toBe('PASS');
    expect(overCriticalResult.value).toContain(
      `${A11Y_CRITICAL_MAX + 1} critical is above ${A11Y_CRITICAL_MAX}`,
    );
    expect(overCriticalResult.value).toContain('image-alt on analyze');
    const overPayload = JSON.stringify(overCritical);
    const pretty = `${JSON.stringify(overCritical, null, 2)}\n`;
    expect(pretty).not.toBe(overPayload);
    const overRun = runScript(overPayload);
    expect(overRun.result.status).not.toBe(0);
    expect(overRun.written.status).toBe('FAIL');
    expect(overRun.written.status).not.toBe('PASS');
    expect(overRun.result.stdout).toContain('accessibility: FAIL');
    expect(overRun.result.stdout).toContain('image-alt on analyze');
    expect(overRun.written.evidencePath).toBe(AXE_EVIDENCE_PATH);
    expect(readFileSync(join(root, AXE_EVIDENCE_PATH), 'utf8')).toBe(
      overPayload,
    );
    expect(createHash('sha256').update(overPayload).digest('hex')).toBe(
      overRun.written.evidenceSha256,
    );
    expect(createHash('sha256').update(pretty).digest('hex')).not.toBe(
      overRun.written.evidenceSha256,
    );

    const overSerious = evaluateAccessibility(
      report([violation('color-contrast', 'serious', A11Y_SERIOUS_MAX + 1)]),
    );
    expect(overSerious.status).toBe('FAIL');
    expect(overSerious.value).toContain(
      `${A11Y_SERIOUS_MAX + 1} serious is above ${A11Y_SERIOUS_MAX}`,
    );
    expect(overSerious.value).toContain('color-contrast on analyze');
    expect(overSerious.status).not.toBe('PASS');
  });

  it('does not pass when the axe report cannot be read', () => {
    expect(accessibilityCounts(null)).toBeNull();
    expect(accessibilityCounts({})).toBeNull();
    expect(
      accessibilityCounts({ scans: [{ screen: 'analyze', violations: [] }] }),
    ).toBeNull();
    expect(evaluateAccessibility(null).status).toBe('UNKNOWN');
    expect(evaluateAccessibility(null).status).not.toBe('PASS');
    expect(
      evaluateAccessibility(
        report([
          { id: 'custom', impact: 'weird', nodes: [{ impact: 'weird' }] },
        ]),
      ).status,
    ).toBe('UNKNOWN');

    for (const payload of ['missing', '{', '[]'] as const) {
      const { result, written } = runScript(payload);
      expect(result.status).not.toBe(0);
      expect(written.status).toBe('UNKNOWN');
      expect(written.status).not.toBe('PASS');
      expect(written.value).toContain('Counts unavailable');
      expect(written.evidenceSha256 ?? null).toBeNull();
    }
  });

  it('points the scan and the gate at the same raw axe file', () => {
    const spec = readFileSync(
      join(root, 'cypress/e2e/accessibility.cy.ts'),
      'utf8',
    );
    const script = readFileSync(
      join(root, 'scripts/ci/check-accessibility.mjs'),
      'utf8',
    );
    expect(spec).toContain(AXE_RAW_PATH);
    expect(script).toContain(AXE_RAW_PATH);
    for (const screen of REQUIRED_A11Y_SCREENS) {
      expect(spec).toContain(`'${screen}'`);
    }
  });
});
