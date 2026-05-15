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

vi.mock('@src/infrastructure/youtube/probeYtdlpVersion.js', () => ({
  probeYtdlpVersion: vi.fn(),
}));

vi.mock('@src/interface/ipc/errorStore.js', () => ({
  getLastError: vi.fn(),
  getLastErrorDetail: vi.fn(),
  getLastSubmittedUrl: vi.fn(),
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
    const { getLastError, getLastErrorDetail, getLastSubmittedUrl } =
      await import('@src/interface/ipc/errorStore.js');
    const { probeYtdlpVersion } = await import(
      '@src/infrastructure/youtube/probeYtdlpVersion.js'
    );
    const { existsSync } = await import('node:fs');

    vi.mocked(resolveYtdlpExecutable).mockReturnValue('yt-dlp');
    vi.mocked(resolveFfmpegExecutable).mockReturnValue('ffmpeg');
    vi.mocked(getLastError).mockReturnValue(undefined);
    vi.mocked(getLastErrorDetail).mockReturnValue(undefined);
    vi.mocked(getLastSubmittedUrl).mockReturnValue(undefined);
    vi.mocked(existsSync).mockReturnValue(true);

    const { getDiagnosticsHandler } = await import(
      '@src/interface/ipc/getDiagnosticsHandler.js'
    );
    const report = await getDiagnosticsHandler();

    expect(report.ytdlpFound).toBe(false);
    expect(report.ffmpegFound).toBe(false);
    expect(probeYtdlpVersion).not.toHaveBeenCalled();
  });

  it('ytdlpFound is true when path is absolute and existsSync returns true', async () => {
    const { resolveYtdlpExecutable } = await import(
      '@src/infrastructure/youtube/resolveYtdlpExecutable.js'
    );
    const { resolveFfmpegExecutable } = await import(
      '@src/infrastructure/ffmpeg/resolveFfmpegExecutable.js'
    );
    const { getLastError, getLastErrorDetail } = await import(
      '@src/interface/ipc/errorStore.js'
    );
    const { probeYtdlpVersion } = await import(
      '@src/infrastructure/youtube/probeYtdlpVersion.js'
    );
    const { existsSync } = await import('node:fs');

    vi.mocked(resolveYtdlpExecutable).mockReturnValue('/usr/local/bin/yt-dlp');
    vi.mocked(resolveFfmpegExecutable).mockReturnValue('/usr/local/bin/ffmpeg');
    vi.mocked(getLastError).mockReturnValue(undefined);
    vi.mocked(getLastErrorDetail).mockReturnValue(undefined);
    vi.mocked(probeYtdlpVersion).mockResolvedValue('2026.03.17');
    vi.mocked(existsSync).mockReturnValue(true);

    const { getDiagnosticsHandler } = await import(
      '@src/interface/ipc/getDiagnosticsHandler.js'
    );
    const report = await getDiagnosticsHandler();

    expect(report.ytdlpFound).toBe(true);
    expect(report.ffmpegFound).toBe(true);
    expect(report.ytdlpVersion).toBe('2026.03.17');
    expect(probeYtdlpVersion).toHaveBeenCalledWith('/usr/local/bin/yt-dlp');
  });

  it('pathEnv is capped at 500 chars', async () => {
    const { resolveYtdlpExecutable } = await import(
      '@src/infrastructure/youtube/resolveYtdlpExecutable.js'
    );
    const { resolveFfmpegExecutable } = await import(
      '@src/infrastructure/ffmpeg/resolveFfmpegExecutable.js'
    );
    const { getLastError, getLastErrorDetail } = await import(
      '@src/interface/ipc/errorStore.js'
    );
    const { existsSync } = await import('node:fs');

    vi.mocked(resolveYtdlpExecutable).mockReturnValue('yt-dlp');
    vi.mocked(resolveFfmpegExecutable).mockReturnValue('ffmpeg');
    vi.mocked(getLastError).mockReturnValue(undefined);
    vi.mocked(getLastErrorDetail).mockReturnValue(undefined);
    vi.mocked(existsSync).mockReturnValue(false);

    const { getDiagnosticsHandler } = await import(
      '@src/interface/ipc/getDiagnosticsHandler.js'
    );
    const report = await getDiagnosticsHandler();

    expect(report.pathEnv.length).toBeLessThanOrEqual(500);
  });

  it('lastError, lastErrorDetail, and lastSubmittedUrl come from errorStore', async () => {
    const { resolveYtdlpExecutable } = await import(
      '@src/infrastructure/youtube/resolveYtdlpExecutable.js'
    );
    const { resolveFfmpegExecutable } = await import(
      '@src/infrastructure/ffmpeg/resolveFfmpegExecutable.js'
    );
    const { getLastError, getLastErrorDetail, getLastSubmittedUrl } =
      await import('@src/interface/ipc/errorStore.js');
    const { existsSync } = await import('node:fs');

    vi.mocked(resolveYtdlpExecutable).mockReturnValue('yt-dlp');
    vi.mocked(resolveFfmpegExecutable).mockReturnValue('ffmpeg');
    vi.mocked(getLastError).mockReturnValue('Could not analyze this video right now.');
    vi.mocked(getLastErrorDetail).mockReturnValue('network down');
    vi.mocked(getLastSubmittedUrl).mockReturnValue(
      'https://www.youtube.com/watch?v=Zt62nsFLqA0&list=RDZt62nsFLqA0&start_radio=1',
    );
    vi.mocked(existsSync).mockReturnValue(false);

    const { getDiagnosticsHandler } = await import(
      '@src/interface/ipc/getDiagnosticsHandler.js'
    );
    const report = await getDiagnosticsHandler();

    expect(report.lastError).toBe('Could not analyze this video right now.');
    expect(report.lastErrorDetail).toBe('network down');
    expect(report.lastSubmittedUrl).toBe(
      'https://www.youtube.com/watch?v=Zt62nsFLqA0&list=RDZt62nsFLqA0&start_radio=1',
    );
  });

  it('appVersion comes from app.getVersion()', async () => {
    const { resolveYtdlpExecutable } = await import(
      '@src/infrastructure/youtube/resolveYtdlpExecutable.js'
    );
    const { resolveFfmpegExecutable } = await import(
      '@src/infrastructure/ffmpeg/resolveFfmpegExecutable.js'
    );
    const { getLastError, getLastErrorDetail } = await import(
      '@src/interface/ipc/errorStore.js'
    );
    const { existsSync } = await import('node:fs');

    vi.mocked(resolveYtdlpExecutable).mockReturnValue('yt-dlp');
    vi.mocked(resolveFfmpegExecutable).mockReturnValue('ffmpeg');
    vi.mocked(getLastError).mockReturnValue(undefined);
    vi.mocked(getLastErrorDetail).mockReturnValue(undefined);
    vi.mocked(existsSync).mockReturnValue(false);

    const { getDiagnosticsHandler } = await import(
      '@src/interface/ipc/getDiagnosticsHandler.js'
    );
    const report = await getDiagnosticsHandler();

    expect(report.appVersion).toBe('1.2.3');
  });
});
