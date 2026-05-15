import { beforeEach, describe, expect, it, vi } from 'vitest';

const execFileMock = vi.fn();

vi.mock('node:child_process', () => ({
  execFile: execFileMock,
  default: { execFile: execFileMock },
}));

describe('probeYtdlpVersion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns undefined for bare executable name', async () => {
    const { probeYtdlpVersion } = await import(
      '@src/infrastructure/youtube/probeYtdlpVersion.js'
    );
    await expect(probeYtdlpVersion('yt-dlp')).resolves.toBeUndefined();
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it('returns trimmed stdout when execFile succeeds', async () => {
    execFileMock.mockImplementation(
      (
        _exe: string,
        _args: string[],
        _opts: unknown,
        callback: (error: Error | null, result: { stdout: string; stderr: string }) => void,
      ) => {
        callback(null, { stdout: '2026.03.17\n', stderr: '' });
      },
    );

    const { probeYtdlpVersion } = await import(
      '@src/infrastructure/youtube/probeYtdlpVersion.js'
    );
    await expect(probeYtdlpVersion('/bin/yt-dlp')).resolves.toBe('2026.03.17');
  });

  it('returns undefined when execFile fails', async () => {
    execFileMock.mockImplementation(
      (
        _exe: string,
        _args: string[],
        _opts: unknown,
        callback: (error: Error | null) => void,
      ) => {
        callback(new Error('timeout'));
      },
    );

    const { probeYtdlpVersion } = await import(
      '@src/infrastructure/youtube/probeYtdlpVersion.js'
    );
    await expect(probeYtdlpVersion('/bin/yt-dlp')).resolves.toBeUndefined();
  });
});
