import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { SOCIAL_COMPATIBLE_VIDEO_CONVERTOR_PPA } from '@src/infrastructure/youtube/socialCompatibleMp4Policy';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const spawnMock = vi.fn();
const execFileMock = vi.fn();
const mapFormatsMock = vi.fn();
const mapAudioFormatsMock = vi.fn();
const resolveExecutableMock = vi.fn();

vi.mock('node:child_process', () => ({
  spawn: spawnMock,
  execFile: execFileMock,
  default: {
    spawn: spawnMock,
    execFile: execFileMock,
  },
}));

vi.mock('@src/infrastructure/youtube/mapYtdlpFormatsToQualityOptions', () => ({
  mapYtdlpFormatsToQualityOptions: mapFormatsMock,
}));

vi.mock(
  '@src/infrastructure/youtube/mapYtdlpAudioFormatsToQualityOptions',
  () => ({
    mapYtdlpAudioFormatsToQualityOptions: mapAudioFormatsMock,
  }),
);

vi.mock('@src/infrastructure/youtube/resolveYtdlpExecutable', () => ({
  resolveYtdlpExecutable: resolveExecutableMock,
}));

type FakeReadable = EventEmitter & {
  setEncoding: (encoding: string) => void;
};

type FakeChild = EventEmitter & {
  stdout?: FakeReadable;
  stderr?: FakeReadable;
  kill: () => void;
};

function createFakeReadable(): FakeReadable {
  return Object.assign(new EventEmitter(), {
    setEncoding: vi.fn(),
  });
}

function createFakeChild(): FakeChild {
  return Object.assign(new EventEmitter(), {
    stdout: createFakeReadable(),
    stderr: createFakeReadable(),
    kill: vi.fn(),
  });
}

describe('runYtdlpDownload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    delete process.env.MAXFRAME_E2E;
    delete process.env.MAXFRAME_E2E_FIXTURE;
  });

  it('streams progress lines and resolves when yt-dlp exits with code 0', async () => {
    const child = createFakeChild();
    spawnMock.mockReturnValue(child);
    const lines: string[] = [];
    const { runYtdlpDownload } = await import(
      '@src/infrastructure/youtube/runYtdlpDownload'
    );

    const donePromise = runYtdlpDownload({
      executable: 'yt-dlp',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      formatSelector: '137+bestaudio/best',
      outputTemplate: 'C:\\Videos\\out.%(ext)s',
      mergeOutputFormat: 'mp4',
      onProgressLine: (line) => lines.push(line),
    });

    const spawnArgs = spawnMock.mock.calls[0];
    expect(spawnArgs[0]).toBe('yt-dlp');
    expect(spawnArgs[1]).toEqual([
      '-S',
      'vcodec:h264,acodec:aac',
      '--recode-video',
      'mp4',
      '--ppa',
      SOCIAL_COMPATIBLE_VIDEO_CONVERTOR_PPA,
      '--merge-output-format',
      'mp4',
      '--no-warnings',
      '--no-playlist',
      '--newline',
      '-f',
      '137+bestaudio/best',
      '-o',
      'C:\\Videos\\out.%(ext)s',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    ]);

    child.stdout?.emit('data', '[download] 12.0%\n');
    child.stderr?.emit('data', 'line-a\r\nline-b\r\n');
    child.stderr?.emit('end');
    child.emit('close', 0);

    await expect(donePromise).resolves.toBeUndefined();
    expect(lines).toEqual(['[download] 12.0%', 'line-a', 'line-b']);
  });

  it('streams carriage-return download progress before a final newline', async () => {
    const child = createFakeChild();
    spawnMock.mockReturnValue(child);
    const lines: string[] = [];
    const { runYtdlpDownload } = await import(
      '@src/infrastructure/youtube/runYtdlpDownload'
    );

    const donePromise = runYtdlpDownload({
      executable: 'yt-dlp',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      formatSelector: '137',
      outputTemplate: 'C:\\Videos\\out.%(ext)s',
      onProgressLine: (line) => lines.push(line),
    });

    const p10 = '[download]  10.0% of  100.00MiB at    5.00MiB/s ETA 00:18';
    const p50 = '[download]  50.0% of  100.00MiB at    5.00MiB/s ETA 00:10';
    const p90 = '[download]  90.0% of  100.00MiB at    5.00MiB/s ETA 00:02';
    child.stderr?.emit('data', `${p10}\r${p50}\r${p90}`);
    child.stderr?.emit('end');
    child.emit('close', 0);

    await expect(donePromise).resolves.toBeUndefined();
    expect(lines).toEqual([p10, p50, p90]);
  });

  it('rejects with not-found message when spawn emits ENOENT', async () => {
    const child = createFakeChild();
    spawnMock.mockReturnValue(child);
    const { runYtdlpDownload } = await import(
      '@src/infrastructure/youtube/runYtdlpDownload'
    );

    const donePromise = runYtdlpDownload({
      executable: 'missing-ytdlp',
      url: 'https://youtu.be/x',
      formatSelector: 'best',
      outputTemplate: 'out.%(ext)s',
    });

    const error = Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' });
    child.emit('error', error);

    await expect(donePromise).rejects.toThrow('Could not run "missing-ytdlp"');
  });

  it('rejects with tail logs on non-zero exit and handles abort', async () => {
    const child = createFakeChild();
    spawnMock.mockReturnValue(child);
    const { runYtdlpDownload } = await import(
      '@src/infrastructure/youtube/runYtdlpDownload'
    );

    const controller = new AbortController();
    const donePromise = runYtdlpDownload({
      executable: 'yt-dlp',
      url: 'https://youtu.be/x',
      formatSelector: 'best',
      outputTemplate: 'out.%(ext)s',
      signal: controller.signal,
      timeoutMs: 50,
    });

    child.stderr?.emit('data', 'error one\nerror two\n');
    controller.abort();
    expect(child.kill).toHaveBeenCalledTimes(1);
    child.emit('close', 1);
    await expect(donePromise).rejects.toThrow('Download canceled.');
  });

  it('uses fallback exit-code message when yt-dlp exits without logs', async () => {
    const child = createFakeChild();
    spawnMock.mockReturnValue(child);
    const { runYtdlpDownload } = await import(
      '@src/infrastructure/youtube/runYtdlpDownload'
    );

    const donePromise = runYtdlpDownload({
      executable: 'yt-dlp',
      url: 'https://youtu.be/x',
      formatSelector: 'best',
      outputTemplate: 'out.%(ext)s',
    });

    child.emit('close', null);
    await expect(donePromise).rejects.toThrow(
      'yt-dlp download failed (exit code unknown)',
    );
  });

  it('does NOT add --ffmpeg-location when ffmpegExecutable is omitted', async () => {
    const child = createFakeChild();
    spawnMock.mockReturnValue(child);
    const { runYtdlpDownload } = await import(
      '@src/infrastructure/youtube/runYtdlpDownload'
    );

    const promise = runYtdlpDownload({
      executable: 'yt-dlp',
      url: 'https://youtu.be/x',
      formatSelector: 'best',
      outputTemplate: 'out.%(ext)s',
    });
    child.emit('close', 0);
    await promise;

    const spawnedArgs: string[] = spawnMock.mock.calls[0][1];
    expect(spawnedArgs).not.toContain('--ffmpeg-location');
  });

  it('does NOT add --ffmpeg-location when ffmpegExecutable is a bare name', async () => {
    const child = createFakeChild();
    spawnMock.mockReturnValue(child);
    const { runYtdlpDownload } = await import(
      '@src/infrastructure/youtube/runYtdlpDownload'
    );

    for (const bareName of ['ffmpeg', 'ffmpeg.exe']) {
      spawnMock.mockClear();
      spawnMock.mockReturnValue(createFakeChild());
      const p = runYtdlpDownload({
        executable: 'yt-dlp',
        url: 'https://youtu.be/x',
        formatSelector: 'best',
        outputTemplate: 'out.%(ext)s',
        ffmpegExecutable: bareName,
      });
      spawnMock.mock.results[0]?.value?.emit('close', 0);
      await p;
      const args: string[] = spawnMock.mock.calls[0][1];
      expect(args).not.toContain('--ffmpeg-location');
    }
  });

  it('adds --ffmpeg-location before the URL when ffmpegExecutable is an absolute path', async () => {
    const child = createFakeChild();
    spawnMock.mockReturnValue(child);
    const { runYtdlpDownload } = await import(
      '@src/infrastructure/youtube/runYtdlpDownload'
    );

    const ffmpegPath =
      'C:\\Program Files\\Maxframe\\resources\\ffmpeg\\ffmpeg.exe';
    const url = 'https://youtu.be/x';
    const promise = runYtdlpDownload({
      executable: 'yt-dlp',
      url,
      formatSelector: 'best',
      outputTemplate: 'out.%(ext)s',
      ffmpegExecutable: ffmpegPath,
    });
    child.emit('close', 0);
    await promise;

    const spawnedArgs: string[] = spawnMock.mock.calls[0][1];
    const locationIdx = spawnedArgs.indexOf('--ffmpeg-location');
    expect(locationIdx).toBeGreaterThanOrEqual(0);
    expect(spawnedArgs[locationIdx + 1]).toBe(ffmpegPath);
    // --ffmpeg-location must appear before the URL argument
    expect(locationIdx).toBeLessThan(spawnedArgs.indexOf(url));
  });
});

describe('runYtdlpDownload — social-compatible MP4 args', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MAXFRAME_E2E;
    delete process.env.MAXFRAME_E2E_FIXTURE;
  });

  it('omits social flags when mergeOutputFormat is omitted', async () => {
    const child = createFakeChild();
    spawnMock.mockReturnValue(child);
    const { runYtdlpDownload } = await import(
      '@src/infrastructure/youtube/runYtdlpDownload'
    );

    const promise = runYtdlpDownload({
      executable: 'yt-dlp',
      url: 'https://youtu.be/x',
      formatSelector: 'best',
      outputTemplate: 'out.%(ext)s',
    });
    child.emit('close', 0);
    await promise;

    const spawnedArgs: string[] = spawnMock.mock.calls[0][1];
    expect(spawnedArgs).not.toContain('--recode-video');
    expect(spawnedArgs).not.toContain('--ppa');
    expect(spawnedArgs).not.toContain('-S');
    expect(spawnedArgs).not.toContain('--merge-output-format');
  });

  it('includes social compatibility flags when mergeOutputFormat is mp4', async () => {
    const child = createFakeChild();
    spawnMock.mockReturnValue(child);
    const { runYtdlpDownload } = await import(
      '@src/infrastructure/youtube/runYtdlpDownload'
    );

    const promise = runYtdlpDownload({
      executable: 'yt-dlp',
      url: 'https://youtu.be/x',
      formatSelector: '135+ba[acodec^=mp4a]/bestaudio[acodec^=mp4a]/bestaudio',
      outputTemplate: 'out.%(ext)s',
      mergeOutputFormat: 'mp4',
    });
    child.emit('close', 0);
    await promise;

    const spawnedArgs: string[] = spawnMock.mock.calls[0][1];
    expect(spawnedArgs).toEqual(
      expect.arrayContaining([
        '-S',
        'vcodec:h264,acodec:aac',
        '--recode-video',
        'mp4',
        '--ppa',
        SOCIAL_COMPATIBLE_VIDEO_CONVERTOR_PPA,
        '--merge-output-format',
        'mp4',
      ]),
    );
  });
});

describe('createYtdlpVideoMetadataGateway', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MAXFRAME_E2E;
    delete process.env.MAXFRAME_E2E_FIXTURE;
    resolveExecutableMock.mockReturnValue('resolved-ytdlp');
    mapFormatsMock.mockReturnValue([
      {
        formatId: '137',
        container: 'mp4',
        resolutionLabel: '1080p',
        width: 1920,
        height: 1080,
        fps: 30,
        hasVideo: true,
        hasAudio: false,
      },
    ]);
    mapAudioFormatsMock.mockReturnValue([]);
  });

  it('executes yt-dlp JSON mode and maps parsed output', async () => {
    execFileMock.mockImplementation((_exe, _args, _opts, callback) => {
      callback?.(null, { stdout: '{"formats":[]}', stderr: '' });
    });
    const { createYtdlpVideoMetadataGateway } = await import(
      '@src/infrastructure/youtube/YtdlpVideoMetadataGateway'
    );

    const gateway = createYtdlpVideoMetadataGateway({
      ytdlpExecutable: 'custom-ytdlp',
      timeoutMs: 1234,
    });
    const result = await gateway.analyzeVideo('https://youtu.be/id123');

    expect(execFileMock).toHaveBeenCalledTimes(1);
    expect(execFileMock.mock.calls[0]?.[0]).toBe('custom-ytdlp');
    expect(execFileMock.mock.calls[0]?.[1]).toEqual([
      '-J',
      '--no-warnings',
      '--skip-download',
      'https://youtu.be/id123',
    ]);
    expect(
      (execFileMock.mock.calls[0]?.[2] as Record<string, unknown>).timeout,
    ).toBe(1234);
    expect(mapFormatsMock).toHaveBeenCalledWith({ formats: [] });
    expect(result.videoQualities).toHaveLength(1);
  });

  it('maps ENOENT and stderr/JSON parse failures to user-facing errors', async () => {
    const { createYtdlpVideoMetadataGateway } = await import(
      '@src/infrastructure/youtube/YtdlpVideoMetadataGateway'
    );
    const gateway = createYtdlpVideoMetadataGateway();

    execFileMock.mockImplementationOnce((_exe, _args, _opts, callback) => {
      callback?.(Object.assign(new Error('missing'), { code: 'ENOENT' }));
    });
    await expect(gateway.analyzeVideo('https://youtu.be/a')).rejects.toThrow(
      'Could not run "resolved-ytdlp"',
    );

    execFileMock.mockImplementationOnce((_exe, _args, _opts, callback) => {
      callback?.(
        Object.assign(new Error('failed'), { stderr: 'x'.repeat(600) + '\n' }),
      );
    });
    await expect(gateway.analyzeVideo('https://youtu.be/b')).rejects.toThrow(
      'x'.repeat(500),
    );

    execFileMock.mockImplementationOnce((_exe, _args, _opts, callback) => {
      callback?.(null, { stdout: 'not-json', stderr: '' });
    });
    await expect(gateway.analyzeVideo('https://youtu.be/c')).rejects.toThrow(
      'yt-dlp returned invalid JSON.',
    );
  });

  it('uses gateway defaults and falls back to Error/default messages', async () => {
    const { createYtdlpVideoMetadataGateway } = await import(
      '@src/infrastructure/youtube/YtdlpVideoMetadataGateway'
    );
    const gateway = createYtdlpVideoMetadataGateway();

    execFileMock.mockImplementationOnce((_exe, _args, _opts, callback) => {
      callback?.(new Error('generic failure'));
    });
    await expect(gateway.analyzeVideo('https://youtu.be/d')).rejects.toThrow(
      'generic failure',
    );

    execFileMock.mockImplementationOnce((_exe, _args, _opts, callback) => {
      callback?.({ stderr: 123 } as unknown as Error);
    });
    await expect(gateway.analyzeVideo('https://youtu.be/e')).rejects.toThrow(
      'yt-dlp failed',
    );

    execFileMock.mockImplementationOnce((_exe, _args, opts, callback) => {
      expect((opts as Record<string, unknown>).timeout).toBe(90_000);
      callback?.(null, { stdout: '{"formats":[]}', stderr: '' });
    });
    await expect(
      gateway.analyzeVideo('https://youtu.be/f'),
    ).resolves.toMatchObject({
      videoQualities: [
        {
          formatId: '137',
          container: 'mp4',
          resolutionLabel: '1080p',
          width: 1920,
          height: 1080,
          fps: 30,
          hasVideo: true,
          hasAudio: false,
        },
      ],
      audioQualities: [],
    });
    expect(resolveExecutableMock).toHaveBeenCalled();
  });
});

describe('yt-dlp file URL args', () => {
  let root: string;
  let fixturePath: string;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MAXFRAME_E2E;
    delete process.env.MAXFRAME_E2E_FIXTURE;
    root = mkdtempSync(join(tmpdir(), 'maxframe-e2e-ytdlp-args-'));
    fixturePath = join(root, 'sample.mp4');
    writeFileSync(fixturePath, 'fixture');
    resolveExecutableMock.mockReturnValue('resolved-ytdlp');
    mapFormatsMock.mockReturnValue([]);
    mapAudioFormatsMock.mockReturnValue([]);
  });

  afterEach(() => {
    delete process.env.MAXFRAME_E2E;
    delete process.env.MAXFRAME_E2E_FIXTURE;
    rmSync(root, { recursive: true, force: true });
  });

  async function captureDownloadArgs(url: string): Promise<string[]> {
    const child = createFakeChild();
    spawnMock.mockReturnValue(child);
    const { runYtdlpDownload } = await import(
      '@src/infrastructure/youtube/runYtdlpDownload'
    );
    const pending = runYtdlpDownload({
      executable: 'yt-dlp',
      url,
      formatSelector: 'best',
      outputTemplate: 'out.%(ext)s',
    });
    child.emit('close', 0);
    await pending;
    return spawnMock.mock.calls[0]?.[1] as string[];
  }

  it('keeps --enable-file-urls out of normal analyze and download args', async () => {
    const fileUrl = pathToFileURL(fixturePath).href;
    const downloadArgs = await captureDownloadArgs(fileUrl);
    expect(downloadArgs).toEqual([
      '--no-warnings',
      '--no-playlist',
      '--newline',
      '-f',
      'best',
      '-o',
      'out.%(ext)s',
      fileUrl,
    ]);
    expect(downloadArgs).not.toContain('--enable-file-urls');

    execFileMock.mockImplementation((_exe, _args, _opts, callback) => {
      callback?.(null, { stdout: '{"formats":[]}', stderr: '' });
    });
    const { createYtdlpVideoMetadataGateway } = await import(
      '@src/infrastructure/youtube/YtdlpVideoMetadataGateway'
    );
    const gateway = createYtdlpVideoMetadataGateway({
      ytdlpExecutable: 'yt-dlp',
    });
    await gateway.analyzeVideo(fileUrl);
    const analyzeArgs = execFileMock.mock.calls[0]?.[1] as string[];
    expect(analyzeArgs).toEqual([
      '-J',
      '--no-warnings',
      '--skip-download',
      fileUrl,
    ]);
    expect(analyzeArgs).not.toContain('--enable-file-urls');
  });

  it('passes --enable-file-urls and the file URL when the fixture is active', async () => {
    const fileUrl = pathToFileURL(fixturePath).href;
    process.env.MAXFRAME_E2E = '1';
    process.env.MAXFRAME_E2E_FIXTURE = fixturePath;

    const downloadArgs = await captureDownloadArgs(fileUrl);
    expect(downloadArgs).toEqual([
      '--no-warnings',
      '--no-playlist',
      '--newline',
      '-f',
      'best',
      '-o',
      'out.%(ext)s',
      '--enable-file-urls',
      fileUrl,
    ]);

    execFileMock.mockImplementation((_exe, _args, _opts, callback) => {
      callback?.(null, { stdout: '{"formats":[]}', stderr: '' });
    });
    const { createYtdlpVideoMetadataGateway } = await import(
      '@src/infrastructure/youtube/YtdlpVideoMetadataGateway'
    );
    const gateway = createYtdlpVideoMetadataGateway({
      ytdlpExecutable: 'yt-dlp',
    });
    await gateway.analyzeVideo(fileUrl);
    expect(execFileMock.mock.calls[0]?.[1]).toEqual([
      '-J',
      '--no-warnings',
      '--skip-download',
      '--enable-file-urls',
      fileUrl,
    ]);
  });

  it('adds --enable-file-urls from the fixture gate, not from the URL scheme', async () => {
    process.env.MAXFRAME_E2E = '1';
    process.env.MAXFRAME_E2E_FIXTURE = fixturePath;
    const downloadArgs = await captureDownloadArgs(
      'https://youtu.be/dQw4w9WgXcQ',
    );
    expect(downloadArgs.at(-2)).toBe('--enable-file-urls');
    expect(downloadArgs.at(-1)).toBe('https://youtu.be/dQw4w9WgXcQ');
  });
});
