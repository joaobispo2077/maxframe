import { describe, expect, it } from 'vitest';

import {
  createYtdlpStreamLineState,
  feedYtdlpStreamLines,
  flushYtdlpStreamLines,
} from '@src/infrastructure/youtube/feedYtdlpStreamLines';

describe('feedYtdlpStreamLines', () => {
  it('emits each segment before a carriage return', () => {
    const state = createYtdlpStreamLineState();
    const lines: string[] = [];
    const p10 =
      '[download]  10.0% of  100.00MiB at    5.00MiB/s ETA 00:18';
    const p50 =
      '[download]  50.0% of  100.00MiB at    5.00MiB/s ETA 00:10';
    feedYtdlpStreamLines(state, `${p10}\r${p50}\r`, (line) => lines.push(line));
    expect(lines).toEqual([p10, p50]);
  });

  it('emits newline-terminated lines', () => {
    const state = createYtdlpStreamLineState();
    const lines: string[] = [];
    feedYtdlpStreamLines(state, '[download] 12.0%\n', (line) => lines.push(line));
    expect(lines).toEqual(['[download] 12.0%']);
  });

  it('handles \\r\\n sequences', () => {
    const state = createYtdlpStreamLineState();
    const lines: string[] = [];
    feedYtdlpStreamLines(state, 'line-a\r\nline-b\n', (line) => lines.push(line));
    expect(lines).toEqual(['line-a', 'line-b']);
  });

  it('skips empty trimmed segments', () => {
    const state = createYtdlpStreamLineState();
    const lines: string[] = [];
    feedYtdlpStreamLines(state, '\r\n\r', (line) => lines.push(line));
    expect(lines).toEqual([]);
  });

  it('flushes a non-empty tail on end', () => {
    const state = createYtdlpStreamLineState();
    const lines: string[] = [];
    feedYtdlpStreamLines(
      state,
      '[download]  90.0% of  100.00MiB at    5.00MiB/s ETA 00:02',
      (line) => lines.push(line),
    );
    flushYtdlpStreamLines(state, (line) => lines.push(line));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('90.0%');
  });

  it('prefers newline when it appears before carriage return', () => {
    const state = createYtdlpStreamLineState();
    const lines: string[] = [];
    feedYtdlpStreamLines(state, 'first\nsecond\r', (line) => lines.push(line));
    flushYtdlpStreamLines(state, (line) => lines.push(line));
    expect(lines).toEqual(['first', 'second']);
  });
});
