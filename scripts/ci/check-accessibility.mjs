import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { A11Y_CRITICAL_MAX, A11Y_SERIOUS_MAX } from './quality-floors.mjs';
import { finishGate } from './write-result.mjs';

const UNKNOWN = 'Accessibility: UNKNOWN. Counts unavailable from this run.';

const IMPACTS = ['critical', 'serious', 'moderate', 'minor'];

export const REQUIRED_A11Y_SCREENS = Object.freeze([
  'analyze',
  'analyze-results',
  'queue',
  'settings',
]);

export const AXE_RAW_PATH = 'reports/quality/axe-raw.json';

export const AXE_EVIDENCE_PATH = join(
  'reports/quality/evidence',
  'axe-results.json',
);

function byCodePoint(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function accessibilityFloor(
  critical = A11Y_CRITICAL_MAX,
  serious = A11Y_SERIOUS_MAX,
) {
  return `<= ${critical} critical, <= ${serious} serious`;
}

function impactOf(node, rule) {
  const fromNode = node && typeof node === 'object' ? node.impact : null;
  if (IMPACTS.includes(fromNode)) return fromNode;
  if (IMPACTS.includes(rule?.impact)) return rule.impact;
  return null;
}

function countRule(screen, rule, counts) {
  if (!rule || typeof rule !== 'object' || typeof rule.id !== 'string') {
    return null;
  }
  if (!rule.id || !Array.isArray(rule.nodes)) return null;
  const samples =
    rule.nodes.length > 0 ? rule.nodes : [{ impact: rule.impact }];
  let blocking = 0;
  for (const node of samples) {
    const impact = impactOf(node, rule);
    if (!impact) return null;
    counts[impact] += 1;
    if (impact === 'critical' || impact === 'serious') blocking += 1;
  }
  return {
    screen,
    id: rule.id,
    impact: rule.impact ?? null,
    nodes: samples.length,
    blocking,
  };
}

function sameScreens(scans) {
  if (!Array.isArray(scans) || scans.length !== REQUIRED_A11Y_SCREENS.length) {
    return false;
  }
  const found = [];
  for (const scan of scans) {
    if (!scan || typeof scan.screen !== 'string') return false;
    found.push(scan.screen);
  }
  found.sort(byCodePoint);
  const expected = [...REQUIRED_A11Y_SCREENS].sort(byCodePoint);
  return found.every((name, index) => name === expected[index]);
}

export function accessibilityCounts(report) {
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    return null;
  }
  if (!sameScreens(report.scans)) return null;
  const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  const rules = [];
  for (const scan of report.scans) {
    if (!Array.isArray(scan.violations)) return null;
    for (const rule of scan.violations) {
      const counted = countRule(scan.screen, rule, counts);
      if (!counted) return null;
      rules.push(counted);
    }
  }
  return { ...counts, rules };
}

export function formatAccessibilityValue(counts) {
  return IMPACTS.map((impact) => `${counts[impact]} ${impact}`).join(', ');
}

function overReasons(counts, criticalMax, seriousMax) {
  const reasons = [];
  if (counts.critical > criticalMax) {
    reasons.push(`${counts.critical} critical is above ${criticalMax}`);
  }
  if (counts.serious > seriousMax) {
    reasons.push(`${counts.serious} serious is above ${seriousMax}`);
  }
  return reasons;
}

function blockingRuleText(rules) {
  const listed = rules.filter((rule) => rule.blocking > 0);
  if (listed.length === 0) return '';
  const shown = listed
    .slice(0, 8)
    .map((rule) => `${rule.id} on ${rule.screen}`);
  const more = listed.length > 8 ? `, and ${listed.length - 8} more` : '';
  return `${shown.join(', ')}${more}`;
}

export function evaluateAccessibility(
  report,
  criticalMax = A11Y_CRITICAL_MAX,
  seriousMax = A11Y_SERIOUS_MAX,
) {
  const floor = accessibilityFloor(criticalMax, seriousMax);
  const metrics = accessibilityCounts(report);
  if (!metrics) {
    return { status: 'UNKNOWN', value: UNKNOWN, floor, metrics: null };
  }
  const value = formatAccessibilityValue(metrics);
  const reasons = overReasons(metrics, criticalMax, seriousMax);
  if (reasons.length > 0) {
    const detail = blockingRuleText(metrics.rules);
    const suffix = detail ? ` ${detail}` : '';
    return {
      status: 'FAIL',
      value: `Accessibility: FAIL. ${value}. ${reasons.join('. ')}.${suffix}`,
      floor,
      metrics,
    };
  }
  return { status: 'PASS', value, floor, metrics };
}

function loadAxe(path) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return null;
  }
  try {
    return { raw, report: JSON.parse(raw) };
  } catch {
    return null;
  }
}

function writeAxeEvidence(result, raw) {
  mkdirSync(dirname(AXE_EVIDENCE_PATH), { recursive: true });
  writeFileSync(AXE_EVIDENCE_PATH, raw);
  result.evidenceSha256 = createHash('sha256').update(raw).digest('hex');
  result.evidencePath = AXE_EVIDENCE_PATH;
  return result;
}

function isDirectRun() {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
}

if (isDirectRun()) {
  const loaded = loadAxe(process.env.AXE_JSON || AXE_RAW_PATH);
  const result = evaluateAccessibility(loaded ? loaded.report : null);
  if (loaded && result.metrics) writeAxeEvidence(result, loaded.raw);
  process.exit(finishGate('accessibility', result));
}
