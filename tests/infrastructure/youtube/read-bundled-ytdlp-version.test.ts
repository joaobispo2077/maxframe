import { beforeEach, describe, expect, it, vi } from 'vitest';

const execFileSync = vi.fn();

vi.mock('node:child_process', () => ({
  execFileSync,
  default: { execFileSync },
}));

describe('readBundledYtdlpVersion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('caches a successful probe and a failure', async () => {
    execFileSync.mockReturnValueOnce('2026.03.17\n');
    const mod = await import(
      '@src/infrastructure/youtube/readBundledYtdlpVersion.js'
    );
    const executable = 'C:\\Users\\João\\resources\\yt-dlp\\yt-dlp.exe';
    expect(mod.readBundledYtdlpVersion(executable)).toBe('2026.03.17');
    expect(mod.readBundledYtdlpVersion(executable)).toBe('2026.03.17');
    expect(execFileSync).toHaveBeenCalledTimes(1);
    expect(execFileSync).toHaveBeenCalledWith(
      executable,
      ['--version'],
      expect.not.objectContaining({ shell: true }),
    );

    execFileSync.mockImplementationOnce(() => {
      throw new Error('timeout');
    });
    mod.clearBundledYtdlpVersionCache();
    expect(mod.readBundledYtdlpVersion(executable)).toBeUndefined();
    expect(mod.readBundledYtdlpVersion(executable)).toBeUndefined();
    expect(execFileSync).toHaveBeenCalledTimes(2);
  });

  it('ignores an empty version string', async () => {
    execFileSync.mockReturnValueOnce('   ');
    const mod = await import(
      '@src/infrastructure/youtube/readBundledYtdlpVersion.js'
    );
    expect(mod.readBundledYtdlpVersion('/opt/yt-dlp')).toBeUndefined();
  });
});
