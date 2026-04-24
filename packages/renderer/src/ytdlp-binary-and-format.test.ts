import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildYtdlpFormatSelector } from '../../../src/infrastructure/youtube/buildYtdlpFormatSelector.js';
import { resolveYtdlpExecutable } from '../../../src/infrastructure/youtube/resolveYtdlpExecutable.js';

describe('buildYtdlpFormatSelector', () => {
  it('returns format id only when audio is present', () => {
    expect(buildYtdlpFormatSelector('22', true)).toBe('22');
  });

  it('merges best audio when row is video-only', () => {
    expect(buildYtdlpFormatSelector('137', false)).toBe('137+bestaudio/best');
  });
});

describe('resolveYtdlpExecutable', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.YT_DLP_PATH;
    delete (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  });

  it('prefers YT_DLP_PATH when set', () => {
    process.env.YT_DLP_PATH = 'C:\\tools\\yt-dlp.exe';
    expect(resolveYtdlpExecutable()).toBe('C:\\tools\\yt-dlp.exe');
  });

  it('falls back to yt-dlp on PATH when no env or bundle', () => {
    expect(resolveYtdlpExecutable()).toBe('yt-dlp');
  });
});
