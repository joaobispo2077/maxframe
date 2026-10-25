import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { COMPLEXITY_MAX, CRAP_MAX } from './quality-floors.mjs';

const COMPLEXITY_MESSAGE = /^(.*?) has a complexity of (\d+)\b/;

const FUNCTION_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
]);

export function crapScore(complexity, coveragePct) {
  const cov = Math.min(100, Math.max(0, Number(coveragePct) || 0)) / 100;
  return complexity ** 2 * (1 - cov) ** 3 + complexity;
}

export function parseComplexityMessage(message) {
  const match = String(message ?? '').match(COMPLEXITY_MESSAGE);
  if (!match) return null;
  const kind = match[1].trim();
  if (!kind) return null;
  const complexity = Number(match[2]);
  if (!Number.isInteger(complexity)) return null;
  const quoted = kind.match(/'([^']*)'/);
  let name = '(anonymous)';
  if (quoted) name = quoted[1] || '(anonymous)';
  else {
    const privateName = kind.match(/#([A-Za-z0-9_$]+)/);
    if (privateName) name = `#${privateName[1]}`;
    else if (/\bConstructor\b/.test(kind)) name = 'constructor';
  }
  return { name, complexity };
}

export function readReportedComplexity(message) {
  if (!message || message.fatal) return { fatal: true };
  if (message.ruleId !== 'complexity') return { ignore: true };
  const parsed = parseComplexityMessage(message.message);
  if (!parsed) return { error: String(message.message ?? '') };
  return { parsed };
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

export function functionCoverage(fileCov, startLine, endLine, nested = []) {
  if (!fileCov) return 0;
  if (typeof startLine !== 'number' || typeof endLine !== 'number') return 0;
  const statementMap = fileCov.statementMap ?? {};
  const hits = fileCov.s ?? {};
  let total = 0;
  let covered = 0;
  for (const [id, loc] of Object.entries(statementMap)) {
    const start = loc?.start?.line;
    if (typeof start !== 'number') continue;
    if (start < startLine || start > endLine) continue;
    if (
      nested.some(
        (span) =>
          start >= span.start &&
          start <= span.end &&
          (span.start > startLine || span.end < endLine),
      )
    ) {
      continue;
    }
    total += 1;
    if (Number(hits[id] ?? 0) > 0) covered += 1;
  }
  if (total === 0) return 0;
  return (covered / total) * 100;
}

export function coverageForPath(coverage, rel) {
  if (!coverage) return null;
  const suffix = `/${rel}`;
  const matches = Object.entries(coverage).filter(([file]) => {
    const normal = file.replaceAll('\\', '/');
    return normal === rel || normal.endsWith(suffix);
  });
  if (matches.length === 0) return null;
  matches.sort((left, right) => left[0].length - right[0].length);
  return matches[0][1];
}

function collectSpans(ast) {
  const spans = [];
  const visit = (node) => {
    if (!node || typeof node.type !== 'string') return;
    if (
      FUNCTION_TYPES.has(node.type) ||
      node.type === 'StaticBlock' ||
      node.type === 'PropertyDefinition'
    ) {
      const start = node.loc?.start?.line;
      const end = node.loc?.end?.line;
      if (typeof start === 'number' && typeof end === 'number') {
        spans.push({
          start,
          end,
          function:
            FUNCTION_TYPES.has(node.type) || node.type === 'StaticBlock',
        });
      }
    }
    for (const key of Object.keys(node)) {
      if (key === 'parent') continue;
      const value = node[key];
      if (Array.isArray(value)) {
        for (const child of value) {
          if (child && typeof child.type === 'string') visit(child);
        }
      } else if (value && typeof value.type === 'string') {
        visit(value);
      }
    }
  };
  visit(ast);
  return spans;
}

function fnMapRange(fileCov, line) {
  const fnMap = fileCov?.fnMap;
  if (!fnMap || typeof fnMap !== 'object') return null;
  const hits = [];
  for (const fn of Object.values(fnMap)) {
    const declLine = fn?.decl?.start?.line;
    const locStart = fn?.loc?.start?.line;
    const locEnd = fn?.loc?.end?.line;
    if (typeof locEnd !== 'number') continue;
    if (declLine === line || locStart === line) {
      const start = typeof locStart === 'number' ? locStart : declLine;
      hits.push({ start, end: locEnd });
    }
  }
  if (hits.length === 0) return null;
  hits.sort(
    (left, right) =>
      left.end - left.start - (right.end - right.start) ||
      right.start - left.start,
  );
  return hits[0];
}

function astRange(spans, line) {
  const hits = spans.filter((span) => span.start <= line && line <= span.end);
  if (hits.length === 0) return null;
  hits.sort(
    (left, right) =>
      left.end - left.start - (right.end - right.start) ||
      right.start - left.start,
  );
  return { start: hits[0].start, end: hits[0].end };
}

export function functionRange(fileCov, spans, line) {
  return fnMapRange(fileCov, line) ?? astRange(spans, line);
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
    let spans = [];
    try {
      const parsedAst = parser.parseForESLint(file.text, {
        ecmaVersion: 'latest',
        sourceType: 'module',
        loc: true,
        range: true,
        ecmaFeatures: { jsx: true },
      });
      spans = collectSpans(parsedAst.ast);
    } catch (error) {
      parseErrors.push(`${file.rel}: ${error.message}`);
      continue;
    }
    for (const message of messages) {
      const read = readReportedComplexity(message);
      if (read.fatal) {
        parseErrors.push(`${file.rel}:${message.line || 0} ${message.message}`);
        continue;
      }
      if (read.ignore) continue;
      if (read.error) {
        parseErrors.push(
          `${file.rel}:${message.line || 0} unparsed complexity message: ${read.error}`,
        );
        continue;
      }
      const parsed = read.parsed;
      const line = message.line ?? 0;
      const range = functionRange(fileCov, spans, line);
      if (!range) {
        parseErrors.push(
          `${file.rel}:${line} ${parsed.name} complexity report has no function range`,
        );
        continue;
      }
      const coveragePct = coverage
        ? functionCoverage(
            fileCov,
            range.start,
            range.end,
            spans.filter((span) => span.function),
          )
        : null;
      const crap =
        coveragePct == null ? null : crapScore(parsed.complexity, coveragePct);
      functions.push({
        file: file.rel,
        name: parsed.name,
        line,
        startLine: range.start,
        endLine: range.end,
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
