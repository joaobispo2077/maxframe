import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('resolveFfmpegExecutable bundled candidates', () => {
  const originalPlatform = process.platform;
  const originalResourcesPath = (
    process as NodeJS.Process & { resourcesPath?: string }
  ).resourcesPath;
  let tempRoot: string;

  beforeEach(() => {
    vi.resetModules();
    delete process.env.FFMPEG_PATH;
    Object.defineProperty(process, 'platform', {
      value: 'win32',
      configurable: true,
    });
    tempRoot = mkdtempSync(join(tmpdir(), 'maxframe-ffmpeg-test-'));
    (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath = tempRoot;
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      configurable: true,
    });
    if (originalResourcesPath === undefined) {
      delete (process as NodeJS.Process & { resourcesPath?: string })
        .resourcesPath;
    } else {
      (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath =
        originalResourcesPath;
    }
    rmSync(tempRoot, { recursive: true, force: true });
  });

  it('prefers bundled resources/ffmpeg path when present', async () => {
    const bundledDir = join(tempRoot, 'ffmpeg');
    const bundledExecutable = join(bundledDir, 'ffmpeg.exe');
    mkdirSync(bundledDir, { recursive: true });
    writeFileSync(bundledExecutable, '');

    const { resolveFfmpegExecutable } = await import(
      '@src/infrastructure/ffmpeg/resolveFfmpegExecutable'
    );

    expect(resolveFfmpegExecutable()).toBe(bundledExecutable);
  });

  it('falls through candidates and uses ffmpeg on PATH when none exist', async () => {
    const { resolveFfmpegExecutable } = await import(
      '@src/infrastructure/ffmpeg/resolveFfmpegExecutable'
    );

    expect(resolveFfmpegExecutable()).toBe('ffmpeg');
  });
});
