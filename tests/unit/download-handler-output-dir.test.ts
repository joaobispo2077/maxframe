import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const showSaveDialogMock = vi.fn();
const runYtdlpDownloadMock = vi.fn();
const buildYtdlpFormatSelectorMock = vi.fn();
const probeFfmpegAvailableMock = vi.fn();
const findYtdlpOutputFileMock = vi.fn();
const resolveYtdlpExecutableMock = vi.fn();
const resolveFfmpegExecutableMock = vi.fn();

vi.mock('electron', () => ({
  BrowserWindow: { getFocusedWindow: vi.fn().mockReturnValue(null) },
  dialog: { showSaveDialog: showSaveDialogMock },
}));

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(true),
  };
});

vi.mock('@src/infrastructure/youtube/runYtdlpDownload', () => ({
  runYtdlpDownload: runYtdlpDownloadMock,
}));

vi.mock('@src/infrastructure/youtube/buildYtdlpFormatSelector', () => ({
  buildYtdlpFormatSelector: buildYtdlpFormatSelectorMock,
}));

vi.mock('@src/infrastructure/ffmpeg/probeFfmpegAvailable', () => ({
  probeFfmpegAvailable: probeFfmpegAvailableMock,
  ffmpegMissingMessage: vi.fn().mockReturnValue('ffmpeg missing'),
}));

vi.mock('@src/infrastructure/ffmpeg/resolveFfmpegExecutable', () => ({
  resolveFfmpegExecutable: resolveFfmpegExecutableMock,
}));

vi.mock('@src/infrastructure/youtube/findYtdlpOutputFile', () => ({
  findYtdlpOutputFile: findYtdlpOutputFileMock,
}));

vi.mock('@src/infrastructure/youtube/resolveYtdlpExecutable', () => ({
  resolveYtdlpExecutable: resolveYtdlpExecutableMock,
}));

vi.mock('@src/infrastructure/youtube/ytdlpDownloadNeedsFfmpeg', () => ({
  ytdlpDownloadNeedsFfmpeg: vi.fn().mockReturnValue(false),
}));

const OUTPUT_DIR = 'C:\\Videos\\Maxframe';
const OUTPUT_FILE = `${OUTPUT_DIR}\\Title - Channel.mp4`;

describe('downloadVideoHandler — outputDir batch path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runYtdlpDownloadMock.mockResolvedValue(undefined);
    buildYtdlpFormatSelectorMock.mockReturnValue('137+bestaudio/best');
    probeFfmpegAvailableMock.mockResolvedValue(true);
    findYtdlpOutputFileMock.mockReturnValue(OUTPUT_FILE);
    resolveYtdlpExecutableMock.mockReturnValue('yt-dlp');
    resolveFfmpegExecutableMock.mockReturnValue('ffmpeg');
  });

  it('skips save dialog when outputDir is provided', async () => {
    const { downloadVideoHandler } = await import(
      '../../packages/main/src/downloadVideoHandler'
    );

    await downloadVideoHandler({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      formatId: '137',
      hasAudio: false,
      suggestedFileName: 'Title - Channel.mp4',
      outputMode: 'mp4',
      outputDir: OUTPUT_DIR,
    });

    expect(showSaveDialogMock).not.toHaveBeenCalled();
  });

  it('builds outputTemplate under outputDir from suggestedFileName stem', async () => {
    const { downloadVideoHandler } = await import(
      '../../packages/main/src/downloadVideoHandler'
    );

    await downloadVideoHandler({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      formatId: '137',
      hasAudio: false,
      suggestedFileName: 'Title - Channel.mp4',
      outputMode: 'mp4',
      outputDir: OUTPUT_DIR,
    });

    const call = runYtdlpDownloadMock.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(call.outputTemplate).toBe(
      join(OUTPUT_DIR, 'Title - Channel') + '.%(ext)s',
    );
  });

  it('still shows save dialog when outputDir is omitted', async () => {
    showSaveDialogMock.mockResolvedValue({
      canceled: false,
      filePath: 'C:\\Videos\\manual.mp4',
    });

    const { downloadVideoHandler } = await import(
      '../../packages/main/src/downloadVideoHandler'
    );

    await downloadVideoHandler({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      formatId: '137',
      hasAudio: false,
      suggestedFileName: 'test.mp4',
      outputMode: 'mp4',
    });

    expect(showSaveDialogMock).toHaveBeenCalledTimes(1);
  });
});
