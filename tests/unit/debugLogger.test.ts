import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp') },
}));

vi.mock('node:fs', () => {
  const fns = {
    existsSync: vi.fn(),
    statSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    appendFileSync: vi.fn(),
  };
  return { default: fns, ...fns };
});

describe('debugLogger', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('does NOT write when isDebugModeActive() is false', async () => {
    vi.doMock('@src/interface/ipc/debugModeStore.js', () => ({
      isDebugModeActive: vi.fn(() => false),
    }));

    const fs = await import('node:fs');
    const { writeLogEntry } = await import(
      '@src/infrastructure/diagnostics/debugLogger.js'
    );

    writeLogEntry({ event: 'analyze-error', error: 'test' });

    expect(fs.appendFileSync).not.toHaveBeenCalled();
  });

  it('writes a JSON line when isDebugModeActive() is true', async () => {
    vi.doMock('@src/interface/ipc/debugModeStore.js', () => ({
      isDebugModeActive: vi.fn(() => true),
    }));

    const fs = await import('node:fs');
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const { writeLogEntry } = await import(
      '@src/infrastructure/diagnostics/debugLogger.js'
    );

    writeLogEntry({ event: 'analyze-error', error: 'yt-dlp failed' });

    expect(fs.appendFileSync).toHaveBeenCalledOnce();
    const [logPath, content] = vi.mocked(fs.appendFileSync).mock.calls[0] as [
      string,
      string,
      string,
    ];
    expect(logPath).toContain('maxframe-debug.log');
    const parsed = JSON.parse(content.trim()) as Record<string, unknown>;
    expect(parsed.event).toBe('analyze-error');
    expect(parsed.error).toBe('yt-dlp failed');
    expect(typeof parsed.ts).toBe('string');
  });

  it('rotates log when file size exceeds 500 KB', async () => {
    vi.doMock('@src/interface/ipc/debugModeStore.js', () => ({
      isDebugModeActive: vi.fn(() => true),
    }));

    const fs = await import('node:fs');
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync).mockReturnValue({ size: 600 * 1024 } as ReturnType<
      typeof fs.statSync
    >);

    // Produce 250 lines, rotation keeps last 200
    const lines = Array.from({ length: 250 }, (_, i) =>
      JSON.stringify({ line: i }),
    ).join('\n');
    vi.mocked(fs.readFileSync).mockReturnValue(lines);

    const { writeLogEntry } = await import(
      '@src/infrastructure/diagnostics/debugLogger.js'
    );

    writeLogEntry({ event: 'analyze-error', error: 'big log' });

    expect(fs.writeFileSync).toHaveBeenCalledOnce();
    const [, writtenContent] = vi.mocked(fs.writeFileSync).mock.calls[0] as [
      string,
      string,
      string,
    ];
    const writtenLines = writtenContent.trim().split('\n');
    expect(writtenLines.length).toBe(200);
  });
});
