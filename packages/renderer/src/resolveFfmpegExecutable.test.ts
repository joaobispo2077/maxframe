import { afterEach, describe, expect, it } from 'vitest';

import { resolveFfmpegExecutable } from '../../../src/infrastructure/ffmpeg/resolveFfmpegExecutable.js';

describe('resolveFfmpegExecutable', () => {
  const prev = process.env.FFMPEG_PATH;

  afterEach(() => {
    if (prev === undefined) {
      delete process.env.FFMPEG_PATH;
    } else {
      process.env.FFMPEG_PATH = prev;
    }
  });

  it('returns trimmed FFMPEG_PATH when set', () => {
    process.env.FFMPEG_PATH = '  C:\\tools\\ffmpeg.exe  ';
    expect(resolveFfmpegExecutable()).toBe('C:\\tools\\ffmpeg.exe');
  });

  it('falls back to ffmpeg on PATH when FFMPEG_PATH is unset', () => {
    delete process.env.FFMPEG_PATH;
    expect(resolveFfmpegExecutable()).toBe('ffmpeg');
  });
});
