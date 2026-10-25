import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildYtdlpFormatSelector } from '@src/infrastructure/youtube/buildYtdlpFormatSelector.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function downloadVideoHandler(
  ...args: Parameters<
    typeof import('../../packages/main/src/downloadVideoHandler.js').downloadVideoHandler
  >
) {
  const loaded = await import(
    '../../packages/main/src/downloadVideoHandler.js'
  );
  return loaded.downloadVideoHandler(...args);
}

const showSaveDialogMock = vi.fn();
const runYtdlpDownloadMock = vi.fn();
const probeFfmpegAvailableMock = vi.fn();
const findYtdlpOutputFileMock = vi.fn();
const resolveYtdlpExecutableMock = vi.fn();
const resolveFfmpegExecutableMock = vi.fn();

vi.mock('electron', () => ({
  BrowserWindow: { getFocusedWindow: vi.fn().mockReturnValue(null) },
  dialog: { showSaveDialog: showSaveDialogMock },
}));

vi.mock('@src/infrastructure/youtube/runYtdlpDownload', () => ({
  runYtdlpDownload: runYtdlpDownloadMock,
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

const WATCH_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

function request(
  overrides: Partial<Parameters<typeof downloadVideoHandler>[0]> = {},
) {
  return {
    url: WATCH_URL,
    formatId: '137',
    hasAudio: false,
    suggestedFileName: 'Title - Channel.mp4',
    outputMode: 'mp4' as const,
    ...overrides,
  };
}

function ytdlpCall(): Record<string, unknown> {
  return runYtdlpDownloadMock.mock.calls[0]?.[0] as Record<string, unknown>;
}

describe('downloadVideoHandler e2e fixture hook', () => {
  let root: string;
  let fixturePath: string;
  let outputDir: string;

  beforeEach(() => {
    delete process.env.MAXFRAME_E2E;
    delete process.env.MAXFRAME_E2E_FIXTURE;
    delete process.env.MAXFRAME_E2E_OUTPUT_DIR;
    root = mkdtempSync(join(tmpdir(), 'maxframe-e2e-dl-'));
    fixturePath = join(root, 'sample.mp4');
    outputDir = join(root, 'out');
    writeFileSync(fixturePath, 'fixture');
    mkdirSync(outputDir);
    vi.clearAllMocks();
    showSaveDialogMock.mockResolvedValue({
      canceled: false,
      filePath: join(outputDir, 'manual.mp4'),
    });
    runYtdlpDownloadMock.mockResolvedValue(undefined);
    probeFfmpegAvailableMock.mockResolvedValue(true);
    findYtdlpOutputFileMock.mockReturnValue(join(outputDir, 'saved.mp4'));
    resolveYtdlpExecutableMock.mockReturnValue('yt-dlp');
    resolveFfmpegExecutableMock.mockReturnValue('ffmpeg');
  });

  afterEach(() => {
    delete process.env.MAXFRAME_E2E;
    delete process.env.MAXFRAME_E2E_FIXTURE;
    delete process.env.MAXFRAME_E2E_OUTPUT_DIR;
    rmSync(root, { recursive: true, force: true });
  });

  it('keeps the YouTube URL when the fixture is set without test mode', async () => {
    process.env.MAXFRAME_E2E_FIXTURE = fixturePath;
    process.env.MAXFRAME_E2E_OUTPUT_DIR = outputDir;

    await downloadVideoHandler(request());

    expect(showSaveDialogMock).toHaveBeenCalledTimes(1);
    expect(ytdlpCall().url).toBe(WATCH_URL);
  });

  it('passes the fixture path and the real MP3 arguments', async () => {
    process.env.MAXFRAME_E2E = '1';
    process.env.MAXFRAME_E2E_FIXTURE = fixturePath;
    process.env.MAXFRAME_E2E_OUTPUT_DIR = outputDir;

    await downloadVideoHandler(
      request({
        url: 'https://youtu.be/dQw4w9WgXcQ',
        outputMode: 'mp3',
        hasAudio: true,
        suggestedFileName: 'Song.mp3',
      }),
    );

    expect(showSaveDialogMock).not.toHaveBeenCalled();
    const call = ytdlpCall();
    expect(call.url).toBe(fixturePath);
    expect(call.formatSelector).toBe('bestaudio/best');
    expect(call.extractAudio).toEqual({ format: 'mp3' });
    expect(call.mergeOutputFormat).toBeUndefined();
    expect(call.ffmpegExecutable).toBe('ffmpeg');
    expect(call.outputTemplate).toBe(join(outputDir, 'Song') + '.%(ext)s');
  });

  it('passes the fixture path and the real MP4 selector', async () => {
    process.env.MAXFRAME_E2E = '1';
    process.env.MAXFRAME_E2E_FIXTURE = fixturePath;
    process.env.MAXFRAME_E2E_OUTPUT_DIR = outputDir;

    await downloadVideoHandler(request());

    const call = ytdlpCall();
    expect(call.url).toBe(fixturePath);
    expect(call.formatSelector).toBe(
      buildYtdlpFormatSelector('137', false, 'mp4'),
    );
    expect(call.mergeOutputFormat).toBe('mp4');
    expect(call.extractAudio).toBeUndefined();
  });

  it('lets an explicit outputDir win over the e2e directory', async () => {
    const requestDir = join(root, 'queue');
    mkdirSync(requestDir);
    process.env.MAXFRAME_E2E = '1';
    process.env.MAXFRAME_E2E_FIXTURE = fixturePath;
    process.env.MAXFRAME_E2E_OUTPUT_DIR = outputDir;

    await downloadVideoHandler(request({ outputDir: requestDir }));

    expect(showSaveDialogMock).not.toHaveBeenCalled();
    expect(ytdlpCall().outputTemplate).toBe(
      join(requestDir, 'Title - Channel') + '.%(ext)s',
    );
  });

  it('still opens the save dialog when test mode has no output directory', async () => {
    process.env.MAXFRAME_E2E = '1';
    process.env.MAXFRAME_E2E_FIXTURE = fixturePath;

    await downloadVideoHandler(request());

    expect(showSaveDialogMock).toHaveBeenCalledTimes(1);
    expect(ytdlpCall().url).toBe(fixturePath);
  });

  it('rejects a missing fixture before the save dialog or yt-dlp', async () => {
    process.env.MAXFRAME_E2E = '1';
    process.env.MAXFRAME_E2E_FIXTURE = join(root, 'missing.mp4');
    process.env.MAXFRAME_E2E_OUTPUT_DIR = outputDir;

    await expect(downloadVideoHandler(request())).rejects.toThrow(
      /does not exist/,
    );
    expect(showSaveDialogMock).not.toHaveBeenCalled();
    expect(runYtdlpDownloadMock).not.toHaveBeenCalled();
  });

  it('rejects a non-YouTube link even when the fixture is active', async () => {
    process.env.MAXFRAME_E2E = '1';
    process.env.MAXFRAME_E2E_FIXTURE = fixturePath;

    await expect(
      downloadVideoHandler(request({ url: 'https://example.com/clip.mp4' })),
    ).rejects.toThrow(/Only YouTube URLs are supported/);
    expect(runYtdlpDownloadMock).not.toHaveBeenCalled();
  });
});
