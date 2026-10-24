import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { evaluateAudit } from '../../scripts/ci/check-audit.mjs';
import { AUDIT_HIGH_MAX } from '../../scripts/ci/quality-floors.mjs';

const root = resolve(import.meta.dirname, '../..');

type Via = { severity: string; title: string; name: string } | string;

function advisory(name: string, severity: string): Via {
  return { severity, title: `${name} ${severity} advisory`, name };
}

function reportWith({
  high,
  critical,
  moderate = 0,
  low = 0,
  vulnerabilities,
  advisories,
}: {
  high: number;
  critical: number;
  moderate?: number;
  low?: number;
  vulnerabilities?: Record<string, unknown>;
  advisories?: Record<string, unknown>;
}) {
  return {
    auditReportVersion: 2,
    vulnerabilities: vulnerabilities ?? {},
    advisories,
    metadata: {
      vulnerabilities: {
        info: 0,
        low,
        moderate,
        high,
        critical,
        total: high + critical + moderate + low,
      },
    },
  };
}

function oneCriticalAdvisory(metadataCritical: number) {
  return reportWith({
    high: 12,
    critical: metadataCritical,
    moderate: 6,
    vulnerabilities: {
      'example-critical': {
        name: 'example-critical',
        severity: metadataCritical > 0 ? 'critical' : 'high',
        via: [advisory('example-critical', 'critical'), 'some-parent'],
      },
    },
  });
}

function runAuditScript(report: unknown, npmExit: number) {
  const dir = mkdtempSync(join(tmpdir(), 'audit-gate-'));
  const fixture = join(dir, 'audit.json');
  const bin = join(dir, 'bin');
  const resultPath = join(dir, 'audit-result.json');
  mkdirSync(bin);
  writeFileSync(fixture, JSON.stringify(report));
  writeFileSync(
    join(bin, 'npm'),
    '#!/bin/sh\ncat "$AUDIT_FIXTURE"\nexit "$AUDIT_NPM_EXIT"\n',
  );
  chmodSync(join(bin, 'npm'), 0o755);
  const result = spawnSync(process.execPath, ['scripts/ci/check-audit.mjs'], {
    cwd: root,
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH ?? ''}`,
      AUDIT_FIXTURE: fixture,
      AUDIT_NPM_EXIT: String(npmExit),
      GATE_RESULT: resultPath,
    },
    encoding: 'utf8',
  });
  const written = JSON.parse(readFileSync(resultPath, 'utf8')) as {
    status: string;
    value: string;
    floor: string;
  };
  return { result, written };
}

describe('dependency audit gate script', () => {
  it('exits non-zero for one critical advisory', () => {
    const report = oneCriticalAdvisory(1);
    const evaluated = evaluateAudit(report);
    expect(evaluated.status).toBe('FAIL');
    expect(evaluated.floor).toBe(`0 critical, <= ${AUDIT_HIGH_MAX} high`);
    expect(evaluated.value).toContain('1 critical is above 0');
    expect(evaluated.value).not.toContain('high is above');

    const { result, written } = runAuditScript(report, 1);
    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain('audit: FAIL');
    expect(result.stdout).toContain('1 critical is above 0');
    expect(written.status).toBe('FAIL');
    expect(written.status).not.toBe('PASS');
  });

  it('fails a critical advisory when the rollup says 0 critical', () => {
    const report = oneCriticalAdvisory(0);
    const evaluated = evaluateAudit(report);
    expect(evaluated.status).toBe('FAIL');
    expect(evaluated.value).toContain('1 critical is above 0');
    expect(evaluated.metrics?.critical).toBe(1);

    const { result, written } = runAuditScript(report, 0);
    expect(result.status).not.toBe(0);
    expect(written.status).toBe('FAIL');
    expect(written.value).toContain('1 critical is above 0');
  });

  it('fails a legacy advisories entry with critical severity', () => {
    const report = {
      advisories: {
        '1000': {
          severity: 'critical',
          title: 'Fixture critical advisory',
        },
      },
      metadata: {
        vulnerabilities: { high: 0, critical: 0, moderate: 0, low: 0 },
      },
    };
    const evaluated = evaluateAudit(report);
    expect(evaluated.status).toBe('FAIL');
    expect(evaluated.value).toContain('1 critical is above 0');
    const { result, written } = runAuditScript(report, 0);
    expect(result.status).not.toBe(0);
    expect(written.status).toBe('FAIL');
  });

  it('fails a critical advisory that has no metadata rollup', () => {
    const report = {
      vulnerabilities: {
        'example-critical': {
          name: 'example-critical',
          severity: 'high',
          via: [advisory('example-critical', 'critical')],
        },
      },
    };
    const evaluated = evaluateAudit(report);
    expect(evaluated.status).toBe('FAIL');
    expect(evaluated.status).not.toBe('PASS');
    expect(evaluated.value).toContain('critical is above 0');

    const { result, written } = runAuditScript(report, 1);
    expect(result.status).not.toBe(0);
    expect(written.status).toBe('FAIL');
  });

  it('keeps the high ceiling: 40 passes and 41 fails', () => {
    const onCeiling = reportWith({
      high: AUDIT_HIGH_MAX,
      critical: 0,
      moderate: 6,
      vulnerabilities: {
        'example-high': {
          name: 'example-high',
          severity: 'high',
          via: [advisory('example-high', 'high')],
        },
      },
    });
    expect(evaluateAudit(onCeiling).status).toBe('PASS');
    const onCeilingRun = runAuditScript(onCeiling, 1);
    expect(onCeilingRun.result.status).toBe(0);
    expect(onCeilingRun.written.status).toBe('PASS');
    expect(onCeilingRun.result.stdout).toContain(
      `0 critical, ${AUDIT_HIGH_MAX} high`,
    );
    expect(onCeilingRun.result.stdout).not.toContain('FAIL');

    const over = reportWith({ high: AUDIT_HIGH_MAX + 1, critical: 0 });
    expect(evaluateAudit(over).status).toBe('FAIL');
    expect(evaluateAudit(over).value).toContain(
      `${AUDIT_HIGH_MAX + 1} high is above ${AUDIT_HIGH_MAX}`,
    );
    const overRun = runAuditScript(over, 1);
    expect(overRun.result.status).not.toBe(0);
    expect(overRun.written.status).toBe('FAIL');
    expect(overRun.result.stdout).toContain(
      `${AUDIT_HIGH_MAX + 1} high is above ${AUDIT_HIGH_MAX}`,
    );
  });

  it('fails when the vulnerability list has more highs than the rollup', () => {
    const vulnerabilities: Record<string, unknown> = {};
    for (let index = 0; index < AUDIT_HIGH_MAX + 1; index += 1) {
      const name = `pkg-${index}`;
      vulnerabilities[name] = {
        name,
        severity: 'high',
        via: [advisory(name, 'high')],
      };
    }
    const report = reportWith({
      high: AUDIT_HIGH_MAX,
      critical: 0,
      vulnerabilities,
    });
    const evaluated = evaluateAudit(report);
    expect(evaluated.status).toBe('FAIL');
    expect(evaluated.value).toContain(
      `${AUDIT_HIGH_MAX + 1} high is above ${AUDIT_HIGH_MAX}`,
    );
    const { result, written } = runAuditScript(report, 0);
    expect(result.status).not.toBe(0);
    expect(written.status).toBe('FAIL');
  });

  it('does not block moderate findings when npm exits non-zero', () => {
    const report = reportWith({
      high: 12,
      critical: 0,
      moderate: 6,
      vulnerabilities: {
        'example-moderate': {
          name: 'example-moderate',
          severity: 'moderate',
          via: ['vitest'],
        },
        'example-high': {
          name: 'example-high',
          severity: 'high',
          via: [advisory('example-high', 'high'), 'some-parent'],
        },
      },
    });
    expect(evaluateAudit(report).status).toBe('PASS');
    const { result, written } = runAuditScript(report, 1);
    expect(result.status).toBe(0);
    expect(written.status).toBe('PASS');
    expect(result.stdout).toContain('6 moderate reported');
    expect(written.status).not.toBe('FAIL');
  });

  it('does not pass when the audit report cannot be read', () => {
    const dir = mkdtempSync(join(tmpdir(), 'audit-gate-bad-'));
    const bin = join(dir, 'bin');
    const resultPath = join(dir, 'audit-result.json');
    mkdirSync(bin);
    writeFileSync(join(bin, 'npm'), '#!/bin/sh\necho not-json\nexit 1\n');
    chmodSync(join(bin, 'npm'), 0o755);
    const result = spawnSync(process.execPath, ['scripts/ci/check-audit.mjs'], {
      cwd: root,
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH ?? ''}`,
        GATE_RESULT: resultPath,
      },
      encoding: 'utf8',
    });
    const written = JSON.parse(readFileSync(resultPath, 'utf8')) as {
      status: string;
    };
    expect(result.status).not.toBe(0);
    expect(written.status).toBe('UNKNOWN');
    expect(written.status).not.toBe('PASS');
    expect(evaluateAudit({}).status).toBe('UNKNOWN');
  });
});
