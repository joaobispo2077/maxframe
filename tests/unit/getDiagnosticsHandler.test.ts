import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { getVersion: vi.fn(() => '1.2.3') },
}));

vi.mock('node:fs', () => {
  const fns = { existsSync: vi.fn() };
  return { default: fns, ...fns };
});

vi.mock('@src/infrastructure/youtube/resolveYtdlpExecutable.js', () => ({
  resolveYtdlpExecutable: vi.fn(),
}));

vi.mock('@src/infrastructure/ffmpeg/resolveFfmpegExecutable.js', () => ({
  resolveFfmpegExecutable: vi.fn(),
}));

vi.mock('@src/interface/ipc/errorStore.js', () => ({
  getLastError: vi.fn(),
}));

describe('getDiagnosticsHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PATH = 'A'.repeat(600);
  });

  it('ytdlpFound is false when path equals bare "yt-dlp"', async () => {
    const { resolveYtdlpExecutable } = await import(
      '@src/infrastructure/youtube/resolveYtdlpExecutable.js'
    );
    const { resolveFfmpegExecutable } = await import(
      '@src/infrastructure/ffmpeg/resolveFfmpegExecutable.js'
    );
    const { getLastError } = await import('@src/interface/ipc/errorStore.js');
    const { existsSync } = await import('node:fs');

    vi.mocked(resolveYtdlpExecutable).mockReturnValue('yt-dlp');
    vi.mocked(resolveFfmpegExecutable).mockReturnValue('ffmpeg');
    vi.mocked(getLastError).mockReturnValue(undefined);
    vi.mocked(existsSync).mockReturnValue(true);

    const { getDiagnosticsHandler } = await import(
      '@src/interface/ipc/getDiagnosticsHandler.js'
    );
    const report = getDiagnosticsHandler();

    expect(report.ytdlpFound).toBe(false);
    expect(report.ffmpegFound).toBe(false);
  });

  it('ytdlpFound is true when path is absolute and existsSync returns true', async () => {
    const { resolveYtdlpExecutable } = await import(
      '@src/infrastructure/youtube/resolveYtdlpExecutable.js'
    );
    const { resolveFfmpegExecutable } = await import(
      '@src/infrastructure/ffmpeg/resolveFfmpegExecutable.js'
    );
    const { getLastError } = await import('@src/interface/ipc/errorStore.js');
    const { existsSync } = await import('node:fs');

    vi.mocked(resolveYtdlpExecutable).mockReturnValue('/usr/local/bin/yt-dlp');
    vi.mocked(resolveFfmpegExecutable).mockReturnValue('/usr/local/bin/ffmpeg');
    vi.mocked(getLastError).mockReturnValue(undefined);
    vi.mocked(existsSync).mockReturnValue(true);

    const { getDiagnosticsHandler } = await import(
      '@src/interface/ipc/getDiagnosticsHandler.js'
    );
    const report = getDiagnosticsHandler();

    expect(report.ytdlpFound).toBe(true);
    expect(report.ffmpegFound).toBe(true);
  });

  it('pathEnv is capped at 500 chars', async () => {
    const { resolveYtdlpExecutable } = await import(
      '@src/infrastructure/youtube/resolveYtdlpExecutable.js'
    );
    const { resolveFfmpegExecutable } = await import(
      '@src/infrastructure/ffmpeg/resolveFfmpegExecutable.js'
    );
    const { getLastError } = await import('@src/interface/ipc/errorStore.js');
    const { existsSync } = await import('node:fs');

    vi.mocked(resolveYtdlpExecutable).mockReturnValue('yt-dlp');
    vi.mocked(resolveFfmpegExecutable).mockReturnValue('ffmpeg');
    vi.mocked(getLastError).mockReturnValue(undefined);
    vi.mocked(existsSync).mockReturnValue(false);

    const { getDiagnosticsHandler } = await import(
      '@src/interface/ipc/getDiagnosticsHandler.js'
    );
    const report = getDiagnosticsHandler();

    expect(report.pathEnv.length).toBeLessThanOrEqual(500);
  });

  it('lastError comes from errorStore.getLastError()', async () => {
    const { resolveYtdlpExecutable } = await import(
      '@src/infrastructure/youtube/resolveYtdlpExecutable.js'
    );
    const { resolveFfmpegExecutable } = await import(
      '@src/infrastructure/ffmpeg/resolveFfmpegExecutable.js'
    );
    const { getLastError } = await import('@src/interface/ipc/errorStore.js');
    const { existsSync } = await import('node:fs');

    vi.mocked(resolveYtdlpExecutable).mockReturnValue('yt-dlp');
    vi.mocked(resolveFfmpegExecutable).mockReturnValue('ffmpeg');
    vi.mocked(getLastError).mockReturnValue('yt-dlp crashed');
    vi.mocked(existsSync).mockReturnValue(false);

    const { getDiagnosticsHandler } = await import(
      '@src/interface/ipc/getDiagnosticsHandler.js'
    );
    const report = getDiagnosticsHandler();

    expect(report.lastError).toBe('yt-dlp crashed');
  });

  it('appVersion comes from app.getVersion()', async () => {
    const { resolveYtdlpExecutable } = await import(
      '@src/infrastructure/youtube/resolveYtdlpExecutable.js'
    );
    const { resolveFfmpegExecutable } = await import(
      '@src/infrastructure/ffmpeg/resolveFfmpegExecutable.js'
    );
    const { getLastError } = await import('@src/interface/ipc/errorStore.js');
    const { existsSync } = await import('node:fs');

    vi.mocked(resolveYtdlpExecutable).mockReturnValue('yt-dlp');
    vi.mocked(resolveFfmpegExecutable).mockReturnValue('ffmpeg');
    vi.mocked(getLastError).mockReturnValue(undefined);
    vi.mocked(existsSync).mockReturnValue(false);

    const { getDiagnosticsHandler } = await import(
      '@src/interface/ipc/getDiagnosticsHandler.js'
    );
    const report = getDiagnosticsHandler();

    expect(report.appVersion).toBe('1.2.3');
  });
});
