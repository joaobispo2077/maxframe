import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { evaluateCrapTop } from '../../scripts/ci/check-crap.mjs';
import {
  coverageForPath,
  crapScore,
  evaluateComplexity,
  measureFunctions,
  parseComplexityMessage,
  readReportedComplexity,
} from '../../scripts/ci/crap.mjs';

const root = resolve(import.meta.dirname, '../..');

const KINDS_SOURCE = `export function plain(value: number): number {
  if (value > 0) return 1;
  return 0;
}

export const arrow = (value: number): number => {
  if (value > 0) return 1;
  return 0;
};

export const multiline = (
  value: number,
): number => {
  if (value > 0) return 1;
  return 0;
};

export async function asyncPlain(value: number): Promise<number> {
  if (value > 0) return 1;
  return 0;
};

export const asyncArrow = async (value: number): Promise<number> => {
  if (value > 0) return 1;
  return 0;
};

export class Box {
  constructor(value: number) {
    if (value > 0) throw new Error('x');
  }

  method(value: number): number {
    if (value > 0) return 1;
    return 0;
  }

  async asyncMethod(value: number): Promise<number> {
    if (value > 0) return 1;
    return 0;
  }

  #secret(value: number): number {
    if (value > 0) return 1;
    return 0;
  }

  get value(): number {
    return 1;
  }

  set value(next: number) {
    if (next > 0) throw new Error('x');
  }

  static staticMethod(value: number): number {
    if (value > 0) return 1;
    return 0;
  }

  *gen(value: number): Generator<number> {
    if (value > 0) yield 1;
    yield 0;
  }

  async *asyncGen(value: number): AsyncGenerator<number> {
    if (value > 0) yield 1;
    yield 0;
  }

  handler = (value: number): number => {
    if (value > 0) return 1;
    return 0;
  };
}
`;

const COVERAGE_SOURCE = `export function covered(value: number): number {
  if (value > 0) return value;
  return 0;
}

export function partial(value: number): number {
  if (value > 0) return value;
  return 0;
}

export function outer(value: number): number {
  const inner = (flag: boolean): number => {
    if (flag) return 1;
    return 0;
  };
  if (value > 0) return inner(true);
  return value;
}
`;

function scanRoot() {
  const dir = mkdtempSync(join(root, 'reports/quality/crap-measure-'));
  mkdirSync(join(dir, 'src'), { recursive: true });
  return dir;
}

function byName(
  functions: Array<{ name: string; line: number }>,
  name: string,
) {
  return functions.filter((item) => item.name === name);
}

describe('CRAP function measurement', () => {
  it('parses every complexity message kind and fails closed when it cannot', () => {
    expect(
      parseComplexityMessage(
        "Function 'plain' has a complexity of 2. Maximum allowed is 0.",
      ),
    ).toEqual({ name: 'plain', complexity: 2 });
    expect(
      parseComplexityMessage(
        'Arrow function has a complexity of 2. Maximum allowed is 0.',
      ),
    ).toEqual({ name: '(anonymous)', complexity: 2 });
    expect(
      parseComplexityMessage(
        "Async function 'asyncPlain' has a complexity of 2. Maximum allowed is 0.",
      ),
    ).toEqual({ name: 'asyncPlain', complexity: 2 });
    expect(
      parseComplexityMessage(
        'Async arrow function has a complexity of 2. Maximum allowed is 0.',
      ),
    ).toEqual({ name: '(anonymous)', complexity: 2 });
    expect(
      parseComplexityMessage(
        "Method 'method' has a complexity of 2. Maximum allowed is 0.",
      ),
    ).toEqual({ name: 'method', complexity: 2 });
    expect(
      parseComplexityMessage(
        "Async method 'asyncMethod' has a complexity of 2. Maximum allowed is 0.",
      ),
    ).toEqual({ name: 'asyncMethod', complexity: 2 });
    expect(
      parseComplexityMessage(
        'Private method #secret has a complexity of 2. Maximum allowed is 0.',
      ),
    ).toEqual({ name: '#secret', complexity: 2 });
    expect(
      parseComplexityMessage(
        "Getter 'value' has a complexity of 1. Maximum allowed is 0.",
      ),
    ).toEqual({ name: 'value', complexity: 1 });
    expect(
      parseComplexityMessage(
        "Setter 'value' has a complexity of 2. Maximum allowed is 0.",
      ),
    ).toEqual({ name: 'value', complexity: 2 });
    expect(
      parseComplexityMessage(
        "Static method 'staticMethod' has a complexity of 2. Maximum allowed is 0.",
      ),
    ).toEqual({ name: 'staticMethod', complexity: 2 });
    expect(
      parseComplexityMessage(
        "Generator method 'gen' has a complexity of 2. Maximum allowed is 0.",
      ),
    ).toEqual({ name: 'gen', complexity: 2 });
    expect(
      parseComplexityMessage(
        "Async generator method 'asyncGen' has a complexity of 2. Maximum allowed is 0.",
      ),
    ).toEqual({ name: 'asyncGen', complexity: 2 });
    expect(
      parseComplexityMessage(
        'Constructor has a complexity of 2. Maximum allowed is 0.',
      ),
    ).toEqual({ name: 'constructor', complexity: 2 });
    expect(
      parseComplexityMessage('Class field initializer has a complexity of 1.'),
    ).toEqual({ name: '(anonymous)', complexity: 1 });
    expect(parseComplexityMessage('not a complexity message')).toBeNull();
    expect(parseComplexityMessage(' has a complexity of 2')).toBeNull();

    const unparsed = readReportedComplexity({
      ruleId: 'complexity',
      message: 'totally unexpected',
      line: 4,
    });
    expect(unparsed.error).toBe('totally unexpected');
    const detail = 'src/a.ts:4 unparsed complexity message: totally unexpected';
    const top = evaluateCrapTop({
      functions: [
        {
          file: 'src/a.ts',
          name: 'plain',
          line: 1,
          complexity: 1,
          coveragePct: 100,
          crap: 1,
        },
      ],
      coveragePresent: true,
      parseErrors: [detail],
    });
    expect(top.status).toBe('FAIL');
    expect(top.status).not.toBe('PASS');
    expect(top.value).toContain(detail);
    const complexity = evaluateComplexity(
      { functions: [], coveragePresent: true, parseErrors: [detail] },
      new Set(),
    );
    expect(complexity.status).toBe('FAIL');
    expect(complexity.status).not.toBe('PASS');
  });

  it('keeps every function kind reported by ESLint', async () => {
    const dir = scanRoot();
    try {
      writeFileSync(join(dir, 'src', 'kinds.ts'), KINDS_SOURCE);
      const measured = await measureFunctions(dir, {
        '/virtual/unrelated.ts': { statementMap: {}, s: {}, fnMap: {} },
      });
      expect(measured.parseErrors).toEqual([]);
      const names = measured.functions.map(
        (item: { name: string }) => item.name,
      );
      expect(names).toEqual(
        expect.arrayContaining([
          'plain',
          'asyncPlain',
          'method',
          'asyncMethod',
          '#secret',
          'value',
          'staticMethod',
          'gen',
          'asyncGen',
          'constructor',
          'handler',
        ]),
      );
      expect(byName(measured.functions, '(anonymous)').length).toBeGreaterThan(
        0,
      );
      expect(byName(measured.functions, 'value')).toHaveLength(2);
      const multiline = measured.functions.find(
        (item: { name: string; startLine: number; endLine: number }) =>
          item.name === '(anonymous)' && item.endLine - item.startLine >= 5,
      );
      expect(multiline.startLine).toBeLessThan(multiline.line);
      expect(multiline.endLine).toBeGreaterThan(multiline.line);
      for (const item of measured.functions) {
        expect(item.endLine).toBeGreaterThan(item.line);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('scores a fully covered function at its complexity and a partial one below that', async () => {
    const dir = scanRoot();
    try {
      writeFileSync(join(dir, 'src', 'covered.ts'), COVERAGE_SOURCE);
      const absent = {
        '/virtual/unrelated.ts': { statementMap: {}, s: {}, fnMap: {} },
      };
      const located = await measureFunctions(dir, absent);
      expect(located.parseErrors).toEqual([]);
      const covered = located.functions.find(
        (item: { name: string }) => item.name === 'covered',
      );
      const partial = located.functions.find(
        (item: { name: string }) => item.name === 'partial',
      );
      const outer = located.functions.find(
        (item: { name: string }) => item.name === 'outer',
      );
      const inner = located.functions.find(
        (item: { name: string; line: number }) =>
          item.name === '(anonymous)' && item.line > outer.line,
      );
      const fileKey = join(dir, 'src', 'covered.ts');
      const statement = (line: number) => ({ start: { line } });
      const full = await measureFunctions(dir, {
        [fileKey]: {
          fnMap: {
            covered: {
              decl: { start: { line: covered.line } },
              loc: {
                start: { line: covered.line },
                end: { line: covered.endLine },
              },
            },
          },
          statementMap: {
            a: statement(covered.line + 1),
            b: statement(covered.endLine - 1),
          },
          s: { a: 1, b: 1 },
        },
      });
      const fullCovered = full.functions.find(
        (item: { name: string }) => item.name === 'covered',
      );
      expect(fullCovered.coveragePct).toBe(100);
      expect(fullCovered.crap).toBe(fullCovered.complexity);
      expect(fullCovered.crap).toBe(crapScore(fullCovered.complexity, 100));

      const half = await measureFunctions(dir, {
        [fileKey]: {
          statementMap: {
            a: statement(partial.line + 1),
            b: statement(partial.endLine - 1),
          },
          s: { a: 1, b: 0 },
        },
      });
      const halfPartial = half.functions.find(
        (item: { name: string }) => item.name === 'partial',
      );
      expect(halfPartial.coveragePct).toBe(50);
      expect(halfPartial.crap).toBeCloseTo(
        crapScore(halfPartial.complexity, 50),
        10,
      );
      expect(halfPartial.crap).toBeGreaterThan(halfPartial.complexity);

      const nested = await measureFunctions(dir, {
        [fileKey]: {
          fnMap: {
            outer: {
              decl: { start: { line: outer.line } },
              loc: {
                start: { line: outer.startLine },
                end: { line: outer.endLine },
              },
            },
          },
          statementMap: {
            outerHit: statement(outer.endLine - 1),
            innerMiss: statement(inner.line + 1),
          },
          s: { outerHit: 1, innerMiss: 0 },
        },
      });
      const nestedOuter = nested.functions.find(
        (item: { name: string }) => item.name === 'outer',
      );
      expect(nestedOuter.coveragePct).toBe(100);
      expect(nestedOuter.crap).toBe(nestedOuter.complexity);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('does not let a longer path steal a shorter source file', () => {
    const coverage = {
      '/repo/packages/renderer/src/x.ts': { id: 'renderer' },
      '/repo/src/x.ts': { id: 'root' },
    };
    expect(coverageForPath(coverage, 'src/x.ts')).toEqual({ id: 'root' });
    expect(coverageForPath(coverage, 'packages/renderer/src/x.ts')).toEqual({
      id: 'renderer',
    });
    expect(coverageForPath(coverage, 'src/missing.ts')).toBeNull();
  });
});
