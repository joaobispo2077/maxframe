import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { COMPLEXITY_MAX, CRAP_MAX } from './quality-floors.mjs';

const COMPLEXITY_MESSAGE =
  /^(?:Async\s+)?(?:Arrow function|Function|Method|Constructor)(?:\s+'([^']*)')?\s+has a complexity of (\d+)/;

export function crapScore(complexity, coveragePct) {
  const cov = Math.min(100, Math.max(0, Number(coveragePct) || 0)) / 100;
  return complexity ** 2 * (1 - cov) ** 3 + complexity;
}

export function parseComplexityMessage(message) {
  const match = String(message ?? '').match(COMPLEXITY_MESSAGE);
  if (!match) return null;
  return {
    name: match[1] || '(anonymous)',
    complexity: Number(match[2]),
  };
}

function walkSources(root) {
  const roots = [
    'src',
    'packages/main/src',
    'packages/renderer/src',
    'packages/preload/src',
  ];
  const files = [];
  const visit = (dir) => {
    let entries = [];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      const path = join(dir, name);
      let info;
      try {
        info = statSync(path);
      } catch {
        continue;
      }
      if (info.isDirectory()) {
        if (name === 'node_modules' || name === 'dist' || name === 'tests')
          continue;
        visit(path);
        continue;
      }
      if (!name.endsWith('.ts') && !name.endsWith('.tsx')) continue;
      if (name.endsWith('.d.ts') || name.includes('.test.')) continue;
      files.push(path);
    }
  };
  for (const dir of roots) visit(join(root, dir));
  return files.map((path) => ({
    path,
    rel: relative(root, path).replaceAll('\\', '/'),
    text: readFileSync(path, 'utf8'),
  }));
}

export function functionCoverage(fileCov, line, endLine) {
  if (!fileCov) return 0;
  const statementMap = fileCov.statementMap ?? {};
  const hits = fileCov.s ?? {};
  let total = 0;
  let covered = 0;
  for (const [id, loc] of Object.entries(statementMap)) {
    const start = loc?.start?.line;
    if (typeof start !== 'number') continue;
    if (start < line) continue;
    if (endLine != null && start > endLine) continue;
    total += 1;
    if (Number(hits[id] ?? 0) > 0) covered += 1;
  }
  if (total === 0) return 0;
  return (covered / total) * 100;
}

function coverageForPath(coverage, rel) {
  if (!coverage) return null;
  const match = Object.entries(coverage).find(([file]) =>
    file.replaceAll('\\', '/').endsWith(rel),
  );
  return match ? match[1] : null;
}

export async function measureFunctions(root = process.cwd(), coverage = null) {
  const { Linter } = await import('eslint');
  const tseslint = await import('typescript-eslint');
  const linter = new Linter({ configType: 'flat' });
  const parser = tseslint.parser ?? tseslint.default?.parser;
  const files = walkSources(root);
  const functions = [];
  const parseErrors = [];
  for (const file of files) {
    let messages = [];
    try {
      messages = linter.verify(
        file.text,
        [
          {
            files: ['**/*.{ts,tsx}'],
            languageOptions: {
              parser,
              parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
                ecmaFeatures: { jsx: true },
              },
            },
            rules: {
              complexity: ['warn', { max: 0, variant: 'modified' }],
            },
          },
        ],
        file.path,
      );
    } catch (error) {
      parseErrors.push(`${file.rel}: ${error.message}`);
      continue;
    }
    const fileCov = coverageForPath(coverage, file.rel);
    for (const message of messages) {
      if (message.fatal) {
        parseErrors.push(`${file.rel}:${message.line || 0} ${message.message}`);
        continue;
      }
      const parsed = parseComplexityMessage(message.message);
      if (!parsed) continue;
      const line = message.line ?? 0;
      const endLine = message.endLine ?? null;
      const coveragePct = coverage
        ? functionCoverage(fileCov, line, endLine)
        : null;
      const crap =
        coveragePct == null ? null : crapScore(parsed.complexity, coveragePct);
      functions.push({
        file: file.rel,
        name: parsed.name,
        line,
        complexity: parsed.complexity,
        coveragePct,
        crap,
      });
    }
  }
  return { functions, parseErrors };
}

export function allowKey(item) {
  return `${item.file}:${item.name}`;
}

export function evaluateComplexity(measurement, allowlist, options = {}) {
  const complexityMax = options.complexityMax ?? COMPLEXITY_MAX;
  const crapMax = options.crapMax ?? CRAP_MAX;
  const floor = `complexity <= ${complexityMax}, CRAP <= ${crapMax}, 0 new over the line`;
  if (!measurement || !Array.isArray(measurement.functions)) {
    return {
      status: 'UNKNOWN',
      value: 'CRAP / complexity: UNKNOWN. Counts unavailable from this run.',
      floor,
      metrics: null,
    };
  }
  if (!measurement.coveragePresent) {
    return {
      status: 'UNKNOWN',
      value: 'CRAP / complexity: UNKNOWN. coverage-final.json is missing.',
      floor,
      metrics: null,
    };
  }
  if (measurement.parseErrors?.length) {
    return {
      status: 'FAIL',
      value: `CRAP / complexity: FAIL. ${measurement.parseErrors.slice(0, 5).join('; ')}`,
      floor,
      metrics: null,
    };
  }
  const waived =
    allowlist instanceof Set ? allowlist : new Set(allowlist ?? []);
  const over = [];
  let maxCrap = 0;
  for (const item of measurement.functions) {
    if (typeof item.crap === 'number' && item.crap > maxCrap)
      maxCrap = item.crap;
    const tooComplex = item.complexity > complexityMax;
    const tooCrap = typeof item.crap === 'number' && item.crap > crapMax;
    if (!tooComplex && !tooCrap) continue;
    if (waived.has(allowKey(item))) continue;
    over.push(item);
  }
  const metrics = {
    functions: measurement.functions.length,
    over: over.length,
    allowlisted: waived.size,
    maxCrap: Number(maxCrap.toFixed(2)),
    complexityMax,
    crapMax,
  };
  const value = `${measurement.functions.length} functions, max CRAP ${metrics.maxCrap}, ${over.length} over the line, ${waived.size} allowlisted`;
  if (over.length > 0) {
    const detail = over
      .slice(0, 10)
      .map(
        (item) =>
          `${item.file}:${item.line} ${item.name} complexity ${item.complexity} CRAP ${item.crap?.toFixed?.(2) ?? 'n/a'}`,
      )
      .join('; ');
    return {
      status: 'FAIL',
      value: `CRAP / complexity: FAIL. ${value}. ${detail}`,
      floor,
      metrics,
      over,
    };
  }
  return { status: 'PASS', value, floor, metrics };
}
