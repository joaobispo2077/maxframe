import { EventEmitter } from 'node:events';

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

    const p10 =
      '[download]  10.0% of  100.00MiB at    5.00MiB/s ETA 00:18';
    const p50 =
      '[download]  50.0% of  100.00MiB at    5.00MiB/s ETA 00:10';
    const p90 =
      '[download]  90.0% of  100.00MiB at    5.00MiB/s ETA 00:02';
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

describe('createYtdlpVideoMetadataGateway', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
