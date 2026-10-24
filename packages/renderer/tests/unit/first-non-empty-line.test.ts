import {
  countNonEmptyLines,
  firstNonEmptyLine,
} from '@ui/lib/firstNonEmptyLine';
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
    expect(firstNonEmptyLine('  https://x.test/y  \n')).toBe(
      'https://x.test/y',
    );
  });
});

describe('countNonEmptyLines', () => {
  it('counts only non-empty lines', () => {
    expect(countNonEmptyLines('')).toBe(0);
    expect(countNonEmptyLines('   \n\t\n')).toBe(0);
    expect(countNonEmptyLines('https://youtu.be/a')).toBe(1);
    expect(countNonEmptyLines('https://youtu.be/a\n\nhttps://youtu.be/b')).toBe(
      2,
    );
  });
});
