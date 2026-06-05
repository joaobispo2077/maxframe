import { firstNonEmptyLine } from '@ui/lib/firstNonEmptyLine';
import { describe, expect, it } from 'vitest';

describe('firstNonEmptyLine', () => {
  it('returns undefined when there are only blank lines', () => {
    expect(firstNonEmptyLine('   \n\t\n')).toBeUndefined();
  });

  it('returns the first trimmed non-empty line', () => {
    expect(
      firstNonEmptyLine('\n\nhttps://a.example/watch?v=1\nhttps://b.example/x'),
    ).toBe('https://a.example/watch?v=1');
  });

  it('trims leading and trailing spaces on the chosen line', () => {
    expect(firstNonEmptyLine('  https://x.test/y  \n')).toBe('https://x.test/y');
  });
});
