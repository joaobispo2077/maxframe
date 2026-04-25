import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const existsSyncMock = vi.fn();

vi.mock('node:fs', () => ({
  existsSync: existsSyncMock,
  default: { existsSync: existsSyncMock },
}));

describe('resolveFfmpegExecutable bundled candidates', () => {
  const originalPlatform = process.platform;
  const originalResourcesPath = (process as NodeJS.Process & { resourcesPath?: string })
    .resourcesPath;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.FFMPEG_PATH;
    Object.defineProperty(process, 'platform', {
      value: 'win32',
      configurable: true,
    });
    (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath =
      'C:\\app\\resources';
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
  });

  it('prefers bundled resources/ffmpeg path when present', async () => {
    existsSyncMock.mockImplementation((candidate: string) =>
      candidate.endsWith('\\ffmpeg\\ffmpeg.exe'),
    );
    const { resolveFfmpegExecutable } = await import(
      '@src/infrastructure/ffmpeg/resolveFfmpegExecutable.js'
    );

    expect(resolveFfmpegExecutable()).toBe('C:\\app\\resources\\ffmpeg\\ffmpeg.exe');
  });

  it('falls through candidates and uses ffmpeg on PATH when none exist', async () => {
    existsSyncMock.mockReturnValue(false);
    const { resolveFfmpegExecutable } = await import(
      '@src/infrastructure/ffmpeg/resolveFfmpegExecutable.js'
    );

    expect(resolveFfmpegExecutable()).toBe('ffmpeg');
    expect(existsSyncMock).toHaveBeenCalledTimes(3);
  });
});
