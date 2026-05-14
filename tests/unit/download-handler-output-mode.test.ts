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

describe('downloadVideoHandler — outputMode branching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    showSaveDialogMock.mockResolvedValue({
      canceled: false,
      filePath: OUTPUT_FILE,
    });
    runYtdlpDownloadMock.mockResolvedValue(undefined);
    buildYtdlpFormatSelectorMock.mockReturnValue('137+bestaudio/best');
    probeFfmpegAvailableMock.mockResolvedValue(true);
    findYtdlpOutputFileMock.mockReturnValue(OUTPUT_FILE);
    resolveYtdlpExecutableMock.mockReturnValue('yt-dlp');
    resolveFfmpegExecutableMock.mockReturnValue('ffmpeg');
  });

  it('MP4 mode: runYtdlpDownload called with mergeOutputFormat mp4 and no extractAudio', async () => {
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

    expect(runYtdlpDownloadMock).toHaveBeenCalledTimes(1);
    const call = runYtdlpDownloadMock.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(call.mergeOutputFormat).toBe('mp4');
    expect(call.extractAudio).toBeUndefined();
  });

  it('MP3 mode: runYtdlpDownload called with extractAudio and no mergeOutputFormat', async () => {
    const { downloadVideoHandler } = await import(
      '../../packages/main/src/downloadVideoHandler'
    );

    await downloadVideoHandler({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      formatId: '140',
      hasAudio: true,
      suggestedFileName: 'test.mp3',
      outputMode: 'mp3',
    });

    expect(runYtdlpDownloadMock).toHaveBeenCalledTimes(1);
    const call = runYtdlpDownloadMock.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(call.extractAudio).toEqual({ format: 'mp3' });
    expect(call.mergeOutputFormat).toBeUndefined();
  });

  it('MP3 mode: buildYtdlpFormatSelector called with outputMode mp3', async () => {
    const { downloadVideoHandler } = await import(
      '../../packages/main/src/downloadVideoHandler'
    );

    await downloadVideoHandler({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      formatId: '140',
      hasAudio: true,
      suggestedFileName: 'test.mp3',
      outputMode: 'mp3',
    });

    expect(buildYtdlpFormatSelectorMock).toHaveBeenCalledWith(
      '140',
      true,
      'mp3',
    );
  });

  it('MP4 mode: dialog shows mp4/mkv/webm extensions', async () => {
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

    const dialogCall = showSaveDialogMock.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    const filters = dialogCall.filters as Array<{ extensions: string[] }>;
    expect(filters[0]?.extensions).toContain('mp4');
    expect(filters[0]?.extensions).toContain('mkv');
    expect(filters[0]?.extensions).toContain('webm');
  });

  it('MP3 mode: dialog shows only mp3 extension', async () => {
    const { downloadVideoHandler } = await import(
      '../../packages/main/src/downloadVideoHandler'
    );

    await downloadVideoHandler({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      formatId: '140',
      hasAudio: true,
      suggestedFileName: 'test.mp3',
      outputMode: 'mp3',
    });

    const dialogCall = showSaveDialogMock.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    const filters = dialogCall.filters as Array<{
      name: string;
      extensions: string[];
    }>;
    expect(filters[0]?.extensions).toEqual(['mp3']);
  });

  it('MP3 mode: ffmpeg is checked', async () => {
    const { downloadVideoHandler } = await import(
      '../../packages/main/src/downloadVideoHandler'
    );

    await downloadVideoHandler({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      formatId: '140',
      hasAudio: true,
      suggestedFileName: 'test.mp3',
      outputMode: 'mp3',
    });

    expect(probeFfmpegAvailableMock).toHaveBeenCalled();
  });
});
