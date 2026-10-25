import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

import { mutationDiffState } from './mutation-scope.mjs';
import {
  AUDIT_HIGH_MAX,
  COVERAGE_FLOORS,
  DUPLICATION_CEILING,
  ELECTRON_SECURITY_FLOOR,
  FIND_DUPES_MAX,
  MUTATION_BREAK,
  MUTATION_SURVIVOR_LIMIT,
  complexityFloorLabel,
  coverageFloorLabel,
  mutationFloorLabel,
} from './quality-floors.mjs';

export const LINT_WARNING_BASELINE = 13;
export const LINT_ERROR_BASELINE = 0;

export const BLOCK_GATES = [
  { job: 'typecheck', gate: 'Typecheck', floor: '0 errors' },
  {
    job: 'lint',
    gate: 'Lint',
    floor: `no new violations (0 errors, warnings <= ${LINT_WARNING_BASELINE})`,
  },
  { job: 'format', gate: 'Format', floor: '0 files' },
  { job: 'unit-tests', gate: 'Unit', floor: 'tests pass' },
  { job: 'e2e-tests', gate: 'E2E', floor: 'tests pass' },
  { job: 'coverage', gate: 'Coverage', floor: coverageFloorLabel() },
  {
    job: 'complexity',
    gate: 'CRAP / complexity',
    floor: complexityFloorLabel(),
  },
  {
    job: 'duplication',
    gate: 'Duplication',
    floor: `<= ${DUPLICATION_CEILING}%`,
  },
  { job: 'deadcode', gate: 'Dead code', floor: '0 unwaived' },
  { job: 'architecture', gate: 'Architecture', floor: '0 violations' },
  {
    job: 'audit',
    gate: 'Dependency audit',
    floor: `0 critical, <= ${AUDIT_HIGH_MAX} high`,
  },
  {
    job: 'find-dupes',
    gate: 'Dependency tree (npm find-dupes)',
    floor: `<= ${FIND_DUPES_MAX} packages`,
  },
  {
    job: 'electron-security',
    gate: 'Electron security',
    floor: ELECTRON_SECURITY_FLOOR,
  },
  {
    job: 'scheduled-workflow',
    gate: 'Scheduled workflow',
    floor: 'workflow state readable',
  },
];

export const INFO_GATES = [];

// Planned in #55 and not a job yet. They are listed on the sticky and do not
// affect Overall. They stay out of INFO_GATES so a missing row cannot fail a
// run that already passed every wired gate.
export const NOT_WIRED_GATES = [
  { job: 'windows-smoke', gate: 'Windows build smoke' },
  { job: 'bundled-binaries', gate: 'Bundled binaries' },
  { job: 'accessibility', gate: 'Accessibility (cypress-axe)' },
];

export function unwiredGateRows() {
  return NOT_WIRED_GATES.map((spec) => ({
    gate: spec.gate,
    job: spec.job,
    mode: 'UNWIRED',
    status: 'NOT_WIRED',
    value: `${spec.gate}: Not wired yet. Does not change Overall.`,
    floor: 'none',
    runUrl: null,
    artifactUrl: null,
    evidenceSha256: null,
  }));
}

const INFO_UNAVAILABLE =
  'Unavailable: no evidence from this run. Informational. Does not change Overall.';

const ANSI = /\u001b\[[0-9;]*m/g;

export function sha256Text(text) {
  return createHash('sha256').update(text).digest('hex');
}

export function sha256File(path) {
  return sha256Text(readFileSync(path));
}

export function stripAnsi(text) {
  return String(text).replace(ANSI, '');
}

function readText(path) {
  if (!path || !existsSync(path)) return null;
  return readFileSync(path, 'utf8');
}

function readJson(path) {
  const text = readText(path);
  if (text == null) return null;
  return JSON.parse(text);
}

export function lintFloorLabel() {
  return BLOCK_GATES.find((gate) => gate.job === 'lint').floor;
}

export function readEslintCounts(report) {
  const files = Array.isArray(report) ? report : [];
  return files.reduce(
    (totals, file) => ({
      errors: totals.errors + Number(file?.errorCount ?? 0),
      warnings: totals.warnings + Number(file?.warningCount ?? 0),
    }),
    { errors: 0, warnings: 0 },
  );
}

export function lintBaselineFailures(counts) {
  const failures = [];
  if (counts.errors > LINT_ERROR_BASELINE) {
    failures.push(
      `lint baseline: ${counts.errors} errors, floor is ${LINT_ERROR_BASELINE}`,
    );
  }
  if (counts.warnings > LINT_WARNING_BASELINE) {
    failures.push(
      `lint baseline: ${counts.warnings} warnings, floor is ${LINT_WARNING_BASELINE}`,
    );
  }
  return failures;
}

export function formatLintValue(counts) {
  return `${counts.errors} errors, ${counts.warnings} warnings`;
}

export function formatEslintMessages(report) {
  const lines = [];
  for (const file of Array.isArray(report) ? report : []) {
    for (const message of file?.messages ?? []) {
      const level = message.severity === 2 ? 'error' : 'warning';
      lines.push(
        `${file.filePath}:${message.line ?? 0} ${level} ${message.message} ${message.ruleId ?? ''}`.trim(),
      );
    }
  }
  return lines;
}

export function countTypecheckErrors(logText) {
  if (logText == null) return null;
  const matches = stripAnsi(logText).match(/error TS\d+/g);
  return matches ? matches.length : 0;
}

export function countFormatFiles(logText) {
  if (logText == null) return null;
  const text = stripAnsi(logText);
  const summary = text.match(/Code style issues found in (\d+) files?/);
  if (summary) return Number(summary[1]);
  if (/All matched files use Prettier code style/.test(text)) return 0;
  return null;
}

export function readCoverageTotals(summary) {
  const total = summary?.total;
  if (!total || typeof total !== 'object') return null;
  const metric = (key) => {
    const item = total[key];
    if (!item || typeof item.pct !== 'number' || Number.isNaN(item.pct)) {
      return null;
    }
    return {
      pct: item.pct,
      covered: Number.isFinite(item.covered) ? item.covered : null,
      total: Number.isFinite(item.total) ? item.total : null,
    };
  };
  const lines = metric('lines');
  const statements = metric('statements');
  const branches = metric('branches');
  const functions = metric('functions');
  if (!lines || !statements || !branches || !functions) return null;
  return { lines, statements, branches, functions };
}

function coveragePart(label, item, floor) {
  const counts =
    item.covered != null && item.total != null
      ? ` (${item.covered}/${item.total})`
      : '';
  const threshold = floor == null ? 'none' : String(floor);
  return `${label} ${item.pct.toFixed(2)}%${counts} vs threshold ${threshold}`;
}

export function formatCoverageLines(totals, floors = COVERAGE_FLOORS) {
  return [
    coveragePart('lines', totals.lines, floors.lines),
    coveragePart('statements', totals.statements, floors.statements),
    coveragePart('branches', totals.branches, floors.branches),
    coveragePart('functions', totals.functions, floors.functions),
  ];
}

export function formatCoverageValue(totals, floors = COVERAGE_FLOORS) {
  return formatCoverageLines(totals, floors).join('; ');
}

export function readVitestCounts(report) {
  if (!report || typeof report !== 'object') return null;
  const passed = report.numPassedTests;
  const failed = report.numFailedTests;
  const pending = report.numPendingTests;
  if (![passed, failed, pending].every((value) => Number.isFinite(value))) {
    return null;
  }
  return { passed, failed, skipped: pending };
}

export function formatTestValue(counts) {
  return `${counts.passed} passed, ${counts.failed} failed, ${counts.skipped} skipped`;
}

export function readCypressCounts(report) {
  if (!report || typeof report !== 'object') return null;
  if (report.status === 'failed' && !Number.isFinite(report.totalPassed)) {
    return null;
  }
  const passed = report.totalPassed;
  const failed = report.totalFailed;
  const skipped =
    Number(report.totalSkipped ?? 0) + Number(report.totalPending ?? 0);
  if (![passed, failed].every((value) => Number.isFinite(value))) return null;
  return { passed, failed, skipped };
}

export function readScheduledState(report) {
  if (!report || typeof report !== 'object') return null;
  if (typeof report.state === 'string' && report.state) {
    return { state: report.state, warning: report.warning ?? null };
  }
  if (typeof report.error === 'string' && report.error) {
    return { state: null, warning: report.error };
  }
  return null;
}

export function countMutants(report) {
  const counts = {
    Killed: 0,
    Survived: 0,
    Timeout: 0,
    NoCoverage: 0,
    RuntimeError: 0,
    CompileError: 0,
    Ignored: 0,
    Pending: 0,
  };
  for (const file of Object.values(report?.files ?? {})) {
    for (const mutant of file?.mutants ?? []) {
      const status = mutant?.status ?? 'Pending';
      if (status in counts) counts[status] += 1;
      else counts.Pending += 1;
    }
  }
  return counts;
}

export function scoredMutantTotal(counts) {
  return (
    counts.Killed +
    counts.Survived +
    counts.Timeout +
    counts.NoCoverage +
    counts.RuntimeError +
    counts.CompileError
  );
}

export function parseReuseLine(logText) {
  if (!logText) return null;
  const match = stripAnsi(logText).match(
    /Result:\s+(\d+) of (\d+) mutant result\(s\) are reused/,
  );
  if (!match) return null;
  return { reused: Number(match[1]), universe: Number(match[2]) };
}

function percent(numerator, denominator) {
  if (!denominator) return null;
  return (numerator / denominator) * 100;
}

export function mutationMetrics({
  report,
  logText = '',
  profile = 'incremental',
  cacheDecision = null,
}) {
  if (!report) return null;
  const counts = countMutants(report);
  const scored = scoredMutantTotal(counts);
  const detectedScore = percent(counts.Killed + counts.Timeout, scored);
  const killedOnlyScore = percent(counts.Killed, scored);
  const timeoutPct = percent(counts.Timeout, scored);
  const base = {
    profile,
    killed: counts.Killed,
    survived: counts.Survived,
    timeout: counts.Timeout,
    noCoverage: counts.NoCoverage,
    runtimeError: counts.RuntimeError,
    compileError: counts.CompileError,
    ignored: counts.Ignored,
    scored,
    detectedScore,
    killedOnlyScore,
    timeoutPct,
    timeoutAbove2: timeoutPct != null && timeoutPct > 2,
    zeroMutants: scored === 0,
    countsUnknown: false,
    tested: null,
    cached: null,
    reusedOf: null,
  };
  if (base.zeroMutants) {
    return { ...base, tested: 0, cached: 0 };
  }
  const fresh = profile === 'full' || cacheDecision?.exact === false;
  if (fresh) {
    return { ...base, tested: scored, cached: 0, reusedOf: null };
  }
  const reuse = parseReuseLine(logText);
  if (!reuse) {
    return { ...base, countsUnknown: true };
  }
  return {
    ...base,
    tested: Math.max(0, scored - reuse.reused),
    cached: reuse.reused,
    reusedOf: reuse.universe,
  };
}

function formatPct(value) {
  return value == null ? 'unavailable' : `${value.toFixed(2)}%`;
}

export function strykerRowValue(metrics) {
  if (!metrics || metrics.countsUnknown) {
    return "Reuse counts unavailable. Score is not treated as this run's own result.";
  }
  if (metrics.zeroMutants) return 'Zero mutants. Efficacy unavailable.';
  const timeoutNote = metrics.timeoutAbove2
    ? ` Timeouts above 2% (${formatPct(metrics.timeoutPct)}).`
    : '';
  const scores = `Score ${formatPct(metrics.detectedScore)}. Killed only ${formatPct(metrics.killedOnlyScore)}.`;
  return `Profile: ${metrics.profile}. ${metrics.tested} tested this run, ${metrics.cached} cached. ${scores}${timeoutNote}`.trim();
}

export function topSurvivors(report, limit = MUTATION_SURVIVOR_LIMIT) {
  const rows = [];
  for (const [file, data] of Object.entries(report?.files ?? {})) {
    const survived = (data?.mutants ?? []).filter(
      (mutant) => mutant?.status === 'Survived',
    ).length;
    if (survived > 0) rows.push({ file, survived });
  }
  rows.sort(
    (left, right) =>
      right.survived - left.survived || left.file.localeCompare(right.file),
  );
  return rows.slice(0, limit);
}

export function buildStrykerRow({
  metrics,
  jobResult,
  runUrl = null,
  evidenceSha256 = null,
  artifactUrl = null,
  artifactName = null,
  floor = MUTATION_BREAK,
  receiptStatus = null,
  mutationScope = null,
}) {
  const base = {
    gate: 'Mutation',
    job: 'mutation-tests',
    mode: 'BLOCK',
    floor: mutationFloorLabel(floor),
    runUrl,
    evidenceSha256,
    artifactUrl,
    artifactName,
  };
  if (jobResult === 'skipped') {
    return {
      ...base,
      status: 'FAIL',
      value: 'Mutation: FAIL. Skipped, no evidence from this run.',
      evidenceSha256: null,
      artifactUrl: null,
      artifactName: null,
    };
  }
  if (jobResult === 'cancelled') {
    return {
      ...base,
      status: 'FAIL',
      value: 'Mutation: FAIL. Cancelled, no evidence from this run.',
      evidenceSha256: null,
      artifactUrl: null,
      artifactName: null,
    };
  }
  const diff = mutationDiffState(mutationScope);
  if (diff === 'unchanged') {
    if (jobResult && jobResult !== 'success') {
      return {
        ...base,
        status: 'FAIL',
        value: 'Mutation: FAIL. The mutation job did not succeed.',
      };
    }
    return {
      ...base,
      mode: 'INFO',
      status: 'INFO',
      value: 'Mutation: INFO. no mutable source changed.',
    };
  }
  if (diff !== 'changed') {
    return {
      ...base,
      status: 'FAIL',
      value: 'Mutation: FAIL. Diff against the mutate set is unavailable.',
      evidenceSha256: null,
    };
  }
  if (
    receiptStatus === 'UNKNOWN' ||
    !metrics ||
    metrics.countsUnknown ||
    metrics.zeroMutants
  ) {
    const value = metrics?.zeroMutants
      ? 'Zero mutants. Efficacy unavailable.'
      : metrics?.countsUnknown
        ? `Mutation: UNKNOWN. ${strykerRowValue(metrics)}`
        : 'Mutation: UNKNOWN. Counts unavailable from this run.';
    return {
      ...base,
      status: 'UNKNOWN',
      value,
      evidenceSha256: metrics && !metrics.zeroMutants ? evidenceSha256 : null,
    };
  }
  if (metrics.tested == null || metrics.tested === 0) {
    const cached = Number.isFinite(metrics.cached) ? metrics.cached : 0;
    const tested = metrics.tested ?? 0;
    return {
      ...base,
      status: 'FAIL',
      value: `Mutation: FAIL. Mutable source changed, but 0 mutants tested this run. Score is cache-only. ${tested} tested this run, ${cached} cached.`,
    };
  }
  const value = strykerRowValue(metrics);
  const below = metrics.detectedScore == null || metrics.detectedScore < floor;
  if (below || (jobResult && jobResult !== 'success')) {
    return {
      ...base,
      status: 'FAIL',
      value: value.startsWith('Mutation:') ? value : `Mutation: FAIL. ${value}`,
    };
  }
  return { ...base, status: 'PASS', value };
}

function needsResult(needs, job) {
  const evidence = needs?.[job];
  if (!evidence || typeof evidence !== 'object') return null;
  return typeof evidence.result === 'string' ? evidence.result : null;
}

export function isMissingCountValue(value) {
  if (value == null) return true;
  const text = String(value).trim();
  if (!text) return true;
  return /unavailable/i.test(text);
}

function blockRow(spec, needs, receipt, runUrl) {
  const result = needsResult(needs, spec.job);
  const base = {
    gate: spec.gate,
    job: spec.job,
    mode: 'BLOCK',
    floor: receipt?.floor || spec.floor,
    runUrl: runUrl || null,
    evidenceSha256: receipt?.evidenceSha256 || null,
    artifactUrl: receipt?.artifactUrl || null,
    artifactName: receipt?.artifactName || null,
  };
  if (result === 'skipped') {
    return {
      ...base,
      status: 'FAIL',
      value: `${spec.gate}: FAIL. Skipped, no evidence from this run.`,
      evidenceSha256: null,
      artifactUrl: null,
      artifactName: null,
    };
  }
  if (result === 'cancelled') {
    return {
      ...base,
      status: 'FAIL',
      value: `${spec.gate}: FAIL. Cancelled, no evidence from this run.`,
      evidenceSha256: null,
      artifactUrl: null,
      artifactName: null,
    };
  }
  if (receipt?.status === 'UNKNOWN') {
    const value =
      typeof receipt.value === 'string' && receipt.value.includes('UNKNOWN')
        ? receipt.value
        : `${spec.gate}: UNKNOWN. Counts unavailable from this run.`;
    return {
      ...base,
      status: 'UNKNOWN',
      value,
      evidenceSha256: null,
      metrics: receipt.metrics ?? null,
    };
  }
  if (!receipt) {
    return {
      ...base,
      status: 'FAIL',
      value: `${spec.gate}: FAIL. No gate.json from this run.`,
      evidenceSha256: null,
      artifactUrl: null,
      artifactName: null,
    };
  }
  if (result !== 'success' || receipt.status !== 'PASS') {
    const detail = !receipt.value
      ? `${spec.gate}: FAIL. Unavailable: no evidence from this run.`
      : String(receipt.value).includes(': FAIL')
        ? receipt.value
        : `${spec.gate}: FAIL. ${receipt.value}`;
    return {
      ...base,
      status: 'FAIL',
      value: detail,
      metrics: receipt.metrics ?? null,
    };
  }
  if (isMissingCountValue(receipt.value)) {
    return {
      ...base,
      status: 'UNKNOWN',
      value: `${spec.gate}: UNKNOWN. Counts unavailable from this run.`,
      evidenceSha256: null,
    };
  }
  return {
    ...base,
    status: 'PASS',
    value: receipt.value,
    metrics: receipt.metrics ?? null,
  };
}

function coverageRow(receipt, runUrl) {
  const coverage = receipt?.coverage;
  if (!coverage?.value) {
    return {
      gate: 'Coverage',
      job: 'coverage',
      mode: 'INFO',
      status: 'UNKNOWN',
      value: INFO_UNAVAILABLE,
      floor: 'none',
      runUrl: runUrl || null,
      evidenceSha256: null,
    };
  }
  return {
    gate: 'Coverage',
    job: 'coverage',
    mode: 'INFO',
    status: 'INFO',
    value: coverage.value,
    floor: 'none',
    runUrl: runUrl || null,
    evidenceSha256: coverage.evidenceSha256 || null,
  };
}

function unknownInfoRow(spec, runUrl) {
  return {
    gate: spec.gate,
    job: spec.job,
    mode: 'INFO',
    status: 'UNKNOWN',
    value: INFO_UNAVAILABLE,
    floor: 'none',
    runUrl: runUrl || null,
    evidenceSha256: null,
  };
}

export function buildQualityRows({
  needs,
  gates,
  jobUrls = {},
  runUrl = null,
}) {
  const rows = BLOCK_GATES.map((spec) =>
    blockRow(
      spec,
      needs,
      gates?.[spec.job] ?? null,
      jobUrls[spec.job] || runUrl,
    ),
  );
  const mutation = gates?.['mutation-tests'] ?? null;
  rows.push(
    buildStrykerRow({
      metrics: mutation?.stryker ?? null,
      jobResult: needsResult(needs, 'mutation-tests'),
      runUrl: jobUrls['mutation-tests'] || runUrl,
      evidenceSha256:
        mutation?.stryker?.evidenceSha256 || mutation?.evidenceSha256 || null,
      artifactUrl: mutation?.artifactUrl || null,
      artifactName: mutation?.artifactName || null,
      floor: MUTATION_BREAK,
      receiptStatus: mutation?.status ?? null,
      mutationScope: mutation?.mutationScope ?? null,
    }),
  );
  return rows;
}

export function attemptLine(runAttempt) {
  if (!runAttempt) return null;
  return `Attempt ${runAttempt}. Passed evidence may come from earlier attempts of the same run.`;
}

function resultEvidence(job, env) {
  const spec = BLOCK_GATES.find((gate) => gate.job === job);
  const path = env.GATE_RESULT || `reports/quality/results/${job}.json`;
  const parsed = readJsonSafe(path);
  const unknown = `${spec?.gate || job}: UNKNOWN. Counts unavailable from this run.`;
  if (!parsed || typeof parsed.status !== 'string') {
    return {
      value: unknown,
      floor: spec?.floor ?? null,
      gateStatus: 'UNKNOWN',
      evidenceSha256: null,
      metrics: null,
      logLines: [unknown],
    };
  }
  return {
    value: parsed.value ?? unknown,
    floor: parsed.floor || spec?.floor || null,
    gateStatus: parsed.status,
    metrics: parsed.metrics ?? null,
    evidenceSha256: parsed.evidenceSha256 ?? null,
    evidencePath:
      typeof parsed.evidencePath === 'string' ? parsed.evidencePath : null,
    logLines: [`${spec?.gate || job}: ${parsed.status}. ${parsed.value ?? ''}`],
  };
}

function hashIfPresent(path) {
  if (!path || !existsSync(path)) return null;
  return sha256File(path);
}

export function evidenceForJob(job, env = process.env) {
  if (job === 'typecheck') {
    const path = env.GATE_LOG || 'reports/quality/typecheck.log';
    const errors = countTypecheckErrors(readText(path));
    return {
      value: errors == null ? 'error count unavailable' : `${errors} errors`,
      floor: '0 errors',
      evidenceSha256: hashIfPresent(path),
      evidencePath: path && existsSync(path) ? path : null,
      logLines: [
        errors == null
          ? 'Typecheck: error count unavailable'
          : `Typecheck: ${errors} errors vs threshold 0`,
      ],
    };
  }
  if (job === 'lint') {
    const path = env.GATE_ESLINT_JSON || 'reports/quality/eslint.json';
    const parsed = readJsonSafe(path);
    if (!parsed) {
      return {
        value: 'error and warning counts unavailable',
        floor: lintFloorLabel(),
        evidenceSha256: null,
        logLines: ['Lint: error and warning counts unavailable'],
      };
    }
    const counts = readEslintCounts(parsed);
    const value = formatLintValue(counts);
    return {
      value,
      floor: lintFloorLabel(),
      evidenceSha256: hashIfPresent(path),
      evidencePath: path && existsSync(path) ? path : null,
      metrics: counts,
      logLines: [`Lint: ${value} vs threshold ${lintFloorLabel()}`],
    };
  }
  if (job === 'format') {
    const path = env.GATE_LOG || 'reports/quality/prettier.log';
    const files = countFormatFiles(readText(path));
    const value =
      files == null ? 'format file count unavailable' : `${files} files`;
    return {
      value,
      floor: '0 files',
      evidenceSha256: hashIfPresent(path),
      evidencePath: path && existsSync(path) ? path : null,
      logLines: [`Format: ${value} vs threshold 0 files`],
    };
  }
  if (job === 'unit-tests') {
    const vitestPath = env.GATE_VITEST_JSON || 'reports/quality/vitest.json';
    const coveragePath =
      env.GATE_COVERAGE_SUMMARY || 'coverage/coverage-summary.json';
    const counts = readVitestCounts(readJsonSafe(vitestPath));
    const totals = readCoverageTotals(readJsonSafe(coveragePath));
    const value = counts
      ? formatTestValue(counts)
      : 'passed, failed, skipped unavailable';
    const coverage = totals
      ? {
          value: formatCoverageValue(totals),
          logLines: ['Coverage summary', ...formatCoverageLines(totals)],
          evidenceSha256: hashIfPresent(coveragePath),
          totals,
        }
      : null;
    const logLines = [`Unit: ${value}`];
    if (coverage) logLines.push(...coverage.logLines);
    else logLines.push('Coverage summary', 'coverage summary unavailable');
    return {
      value,
      floor: 'tests pass',
      evidenceSha256: hashIfPresent(vitestPath),
      evidencePath: existsSync(vitestPath) ? vitestPath : null,
      metrics: counts,
      coverage,
      logLines,
    };
  }
  if (job === 'e2e-tests') {
    const path =
      env.GATE_CYPRESS_JSON || 'reports/quality/cypress-results.json';
    const counts = readCypressCounts(readJsonSafe(path));
    const value = counts
      ? formatTestValue(counts)
      : 'passed, failed, skipped unavailable';
    return {
      value,
      floor: 'tests pass',
      evidenceSha256: hashIfPresent(path),
      evidencePath: path && existsSync(path) ? path : null,
      metrics: counts,
      logLines: [`E2E: ${value}`],
    };
  }
  if (job === 'mutation-tests') {
    const jsonPath = env.GATE_MUTATION_JSON || 'reports/mutation/mutation.json';
    const logPath = env.GATE_STRYKER_LOG || 'reports/quality/stryker.log';
    const decisionPath =
      env.GATE_STRYKER_CACHE_DECISION || 'reports/quality/stryker-cache.json';
    const report = readJsonSafe(jsonPath);
    const decision = readJsonSafe(decisionPath);
    const mutationScope = readJsonSafe(
      env.GATE_MUTATION_SCOPE || 'reports/quality/mutation-scope.json',
    );
    const metrics = mutationMetrics({
      report,
      logText: readText(logPath) ?? '',
      profile: env.GATE_MUTATION_PROFILE || 'incremental',
      cacheDecision: decision,
    });
    const evidenceSha256 = hashIfPresent(jsonPath);
    const evidencePath = existsSync(jsonPath) ? jsonPath : null;
    if (metrics) metrics.evidenceSha256 = evidenceSha256;
    const row = buildStrykerRow({
      metrics,
      jobResult: 'success',
      evidenceSha256,
      mutationScope,
    });
    return {
      value: row.value,
      floor: row.floor,
      gateStatus: row.status === 'PASS' ? undefined : row.status,
      evidenceSha256,
      evidencePath,
      stryker: metrics,
      survivors: topSurvivors(report),
      mutationScope,
      logLines: [`Mutation: ${row.value}`],
    };
  }
  if (job === 'scheduled-workflow') {
    const path =
      env.GATE_SCHEDULED_JSON || 'reports/quality/scheduled-workflow.json';
    const state = readScheduledState(readJsonSafe(path));
    const value = !state
      ? 'workflow state unavailable'
      : state.warning
        ? `${state.state || 'unreadable'}: ${state.warning}`
        : state.state;
    return {
      value,
      floor: 'workflow state readable',
      evidenceSha256: hashIfPresent(path),
      evidencePath: path && existsSync(path) ? path : null,
      logLines: [`Scheduled workflow: ${value}`],
    };
  }
  if (
    [
      'coverage',
      'complexity',
      'duplication',
      'deadcode',
      'architecture',
      'audit',
      'find-dupes',
      'electron-security',
    ].includes(job)
  ) {
    return resultEvidence(job, env);
  }
  if (job === 'size-limit') {
    const path = env.GATE_SIZE_LOG || 'size-limit-raw.txt';
    const text = readText(path);
    const parsed = parseSizeLimit(text, env.GATE_SIZE_EXIT);
    return {
      value: parsed.value,
      floor: parsed.floor,
      evidenceSha256: hashIfPresent(path),
      evidencePath: path && existsSync(path) ? path : null,
      informational: true,
      status: parsed.status,
      logLines: [`Size limit: ${parsed.value}`, `Floor: ${parsed.floor}`],
    };
  }
  return {
    value: 'counts unavailable',
    floor: 'none',
    evidenceSha256: null,
    logLines: [`${job}: counts unavailable`],
  };
}

function readJsonSafe(path) {
  try {
    return readJson(path);
  } catch {
    return null;
  }
}

export function parseSizeLimit(text, exitCode) {
  if (!text) {
    return {
      status: 'UNKNOWN',
      value: INFO_UNAVAILABLE,
      floor: '500 kB (signal only)',
    };
  }
  const limit = text.match(/Size limit:\s*([^\n]+)/i);
  const size = text.match(/^\s*Size:\s*([^\n]+)/im);
  const over = String(exitCode ?? '0') !== '0';
  if (!size) {
    return {
      status: 'UNKNOWN',
      value: 'size measurement unavailable',
      floor: limit
        ? `${limit[1].trim()} (signal only)`
        : '500 kB (signal only)',
    };
  }
  const threshold = limit ? limit[1].trim() : '500 kB';
  const overNote = over ? ' (over limit, signal only)' : '';
  return {
    status: 'INFO',
    value: `${size[1].trim()} vs threshold ${threshold}${overNote}`,
    floor: `${threshold} (signal only)`,
  };
}

export function logLinesForReceipt(receipt) {
  if (Array.isArray(receipt.logLines) && receipt.logLines.length > 0) {
    return receipt.logLines;
  }
  const lines = [`${receipt.name || receipt.job}: ${receipt.status}`];
  if (receipt.value) lines.push(receipt.value);
  if (receipt.coverage?.logLines) lines.push(...receipt.coverage.logLines);
  return lines;
}
