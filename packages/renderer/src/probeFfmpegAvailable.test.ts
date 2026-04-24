import { execFile } from 'node:child_process';

import { describe, expect, it, vi } from 'vitest';

import {
  ffmpegMissingMessage,
  probeFfmpegAvailable,
} from '../../../src/infrastructure/ffmpeg/probeFfmpegAvailable.js';

function findExecCallback(
  args: unknown[],
): ((err: Error | null, stdout?: string) => void) | undefined {
  for (let i = args.length - 1; i >= 0; i -= 1) {
    const arg = args[i];
    if (typeof arg === 'function') {
      return arg as (err: Error | null, stdout?: string) => void;
    }
  }
  return undefined;
}

describe('probeFfmpegAvailable', () => {
  it('returns true when execFile invokes success callback', async () => {
    const exec = vi.fn((...args: unknown[]) => {
      findExecCallback(args)?.(null, 'ffmpeg version 6');
      return {} as ReturnType<typeof execFile>;
    }) as unknown as typeof execFile;

    await expect(probeFfmpegAvailable('/mock/ffmpeg', exec)).resolves.toBe(true);
  });

  it('returns false when execFile invokes error callback', async () => {
    const exec = vi.fn((...args: unknown[]) => {
      findExecCallback(args)?.(new Error('spawn failed'));
      return {} as ReturnType<typeof execFile>;
    }) as unknown as typeof execFile;

    await expect(probeFfmpegAvailable('/mock/ffmpeg', exec)).resolves.toBe(false);
  });
});

describe('ffmpegMissingMessage', () => {
  it('mentions PATH and FFMPEG_PATH', () => {
    const msg = ffmpegMissingMessage('ffmpeg');
    expect(msg).toContain('FFMPEG_PATH');
    expect(msg).toContain('ffmpeg.org');
  });
});
