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

const OUTPUT_FILE = 'C:\\Videos\\out.mp4';

describe('downloadVideoHandler — YouTube URL canonicalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    showSaveDialogMock.mockResolvedValue({
      canceled: false,
      filePath: OUTPUT_FILE,
    });
    runYtdlpDownloadMock.mockResolvedValue(undefined);
    buildYtdlpFormatSelectorMock.mockReturnValue('137');
    probeFfmpegAvailableMock.mockResolvedValue(true);
    findYtdlpOutputFileMock.mockReturnValue(OUTPUT_FILE);
    resolveYtdlpExecutableMock.mockReturnValue('yt-dlp');
    resolveFfmpegExecutableMock.mockReturnValue('ffmpeg');
  });

  it('passes canonical watch URL to runYtdlpDownload for shorts input', async () => {
    const { downloadVideoHandler } = await import(
      '../../packages/main/src/downloadVideoHandler'
    );

    await downloadVideoHandler({
      url: 'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      formatId: '137',
      hasAudio: false,
      suggestedFileName: 'test.mp4',
      outputMode: 'mp4',
    });

    expect(runYtdlpDownloadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      }),
    );
  });
});
