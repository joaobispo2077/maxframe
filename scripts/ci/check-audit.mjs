import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import { AUDIT_HIGH_MAX } from './quality-floors.mjs';
import { finishGate } from './write-result.mjs';

export function auditCounts(report) {
  const counts = report?.metadata?.vulnerabilities;
  if (!counts || typeof counts !== 'object') return null;
  const high = counts.high;
  const critical = counts.critical;
  if (![high, critical].every((value) => Number.isFinite(value))) return null;
  return {
    high,
    critical,
    moderate: Number.isFinite(counts.moderate) ? counts.moderate : null,
    low: Number.isFinite(counts.low) ? counts.low : null,
    total: high + critical,
  };
}

function vulnerabilityEntries(report) {
  const vulns = report?.vulnerabilities;
  if (!vulns || typeof vulns !== 'object' || Array.isArray(vulns)) return [];
  return Object.values(vulns);
}

function advisoryEntries(report) {
  const advisories = report?.advisories;
  if (
    !advisories ||
    typeof advisories !== 'object' ||
    Array.isArray(advisories)
  ) {
    return [];
  }
  return Object.values(advisories);
}

function isCriticalVulnerability(vuln) {
  if (!vuln || typeof vuln !== 'object') return false;
  if (vuln.severity === 'critical') return true;
  if (!Array.isArray(vuln.via)) return false;
  return vuln.via.some(
    (item) => item && typeof item === 'object' && item.severity === 'critical',
  );
}

function entrySeverity(vuln) {
  if (isCriticalVulnerability(vuln)) return 'critical';
  if (!vuln || typeof vuln !== 'object') return null;
  if (vuln.severity === 'high') return 'high';
  if (
    Array.isArray(vuln.via) &&
    vuln.via.some(
      (item) => item && typeof item === 'object' && item.severity === 'high',
    )
  ) {
    return 'high';
  }
  return typeof vuln.severity === 'string' ? vuln.severity : null;
}

function countedSeverity(report, severity) {
  const fromEntries = vulnerabilityEntries(report).filter(
    (vuln) => entrySeverity(vuln) === severity,
  ).length;
  if (severity !== 'critical') return fromEntries;
  const fromAdvisories = advisoryEntries(report).filter(
    (advisory) => advisory?.severity === 'critical',
  ).length;
  return Math.max(fromEntries, fromAdvisories);
}

export function evaluateAudit(report, maxHigh = AUDIT_HIGH_MAX) {
  const floor = `0 critical, <= ${maxHigh} high`;
  const counts = auditCounts(report);
  const listedCritical = countedSeverity(report, 'critical');
  const listedHigh = countedSeverity(report, 'high');
  if (!counts) {
    if (listedCritical < 1) {
      return {
        status: 'UNKNOWN',
        value: 'Dependency audit: UNKNOWN. Counts unavailable from this run.',
        floor,
        metrics: null,
      };
    }
    return {
      status: 'FAIL',
      value: `Dependency audit: FAIL. ${listedCritical} critical, high unavailable. ${listedCritical} critical is above 0`,
      floor,
      metrics: {
        high: null,
        critical: listedCritical,
        moderate: null,
        low: null,
        total: listedCritical,
      },
    };
  }
  // The rollup can say 0 critical while an advisory in the report is
  // critical. The higher count is the one that blocks. Same for high.
  const critical = Math.max(counts.critical, listedCritical);
  const high = Math.max(counts.high, listedHigh);
  const metrics = {
    ...counts,
    high,
    critical,
    total: high + critical,
  };
  const moderate =
    counts.moderate == null ? '' : `, ${counts.moderate} moderate reported`;
  const low = counts.low == null ? '' : `, ${counts.low} low reported`;
  const value = `${critical} critical, ${high} high${moderate}${low}`;
  const reasons = [];
  if (critical > 0) {
    reasons.push(`${critical} critical is above 0`);
  }
  if (high > maxHigh) {
    reasons.push(`${high} high is above ${maxHigh}`);
  }
  if (reasons.length > 0) {
    return {
      status: 'FAIL',
      value: `Dependency audit: FAIL. ${value}. ${reasons.join('. ')}`,
      floor,
      metrics,
    };
  }
  return { status: 'PASS', value, floor, metrics };
}

function readAuditReport(run) {
  try {
    return JSON.parse(run?.stdout || '');
  } catch {
    return null;
  }
}

function auditFromNpmRun(run, maxHigh = AUDIT_HIGH_MAX) {
  const result = evaluateAudit(readAuditReport(run), maxHigh);
  if (run?.stdout) {
    result.evidenceSha256 = createHash('sha256')
      .update(run.stdout)
      .digest('hex');
  }
  return result;
}

function isDirectRun() {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
}

if (isDirectRun()) {
  // npm exits non-zero for moderate findings. Those do not block.
  // The report decides. A zero exit with a critical advisory still fails.
  const run = spawnSync('npm', ['audit', '--json'], {
    encoding: 'utf8',
    maxBuffer: 30 * 1024 * 1024,
  });
  process.exit(finishGate('audit', auditFromNpmRun(run)));
}
