import { beforeEach, describe, expect, it, vi } from 'vitest';

const execFileMock = vi.fn();
const mapVideoFormatsMock = vi.fn();
const mapAudioFormatsMock = vi.fn();
const resolveExecutableMock = vi.fn();

vi.mock('node:child_process', () => ({
  execFile: execFileMock,
  default: { execFile: execFileMock },
}));

vi.mock('@src/infrastructure/youtube/mapYtdlpFormatsToQualityOptions', () => ({
  mapYtdlpFormatsToQualityOptions: mapVideoFormatsMock,
}));

vi.mock('@src/infrastructure/youtube/mapYtdlpAudioFormatsToQualityOptions', () => ({
  mapYtdlpAudioFormatsToQualityOptions: mapAudioFormatsMock,
}));

vi.mock('@src/infrastructure/youtube/resolveYtdlpExecutable', () => ({
  resolveYtdlpExecutable: resolveExecutableMock,
}));

const FAKE_VIDEO_QUALITY = {
  formatId: '137',
  container: 'mp4',
  resolutionLabel: '1080p',
  width: 1920,
  height: 1080,
  fps: 30,
  hasVideo: true,
  hasAudio: false,
};

const FAKE_AUDIO_QUALITY = {
  formatId: '251',
  container: 'webm',
  resolutionLabel: 'Audio-only',
  width: 0,
  height: 0,
  fps: 0,
  hasVideo: false,
  hasAudio: true,
  audioBitrateKbps: 160,
};

describe('createYtdlpVideoMetadataGateway — VideoAnalysis shape', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveExecutableMock.mockReturnValue('yt-dlp');
    mapVideoFormatsMock.mockReturnValue([FAKE_VIDEO_QUALITY]);
    mapAudioFormatsMock.mockReturnValue([FAKE_AUDIO_QUALITY]);
  });

  function succeed(stdout: string) {
    execFileMock.mockImplementation((_exe, _args, _opts, callback) => {
      callback?.(null, { stdout, stderr: '' });
    });
  }

  it('returns title and uploader from yt-dlp JSON', async () => {
    succeed(
      JSON.stringify({ formats: [], title: 'My Video', uploader: 'My Channel' }),
    );
    const { createYtdlpVideoMetadataGateway } = await import(
      '@src/infrastructure/youtube/YtdlpVideoMetadataGateway'
    );
    const gateway = createYtdlpVideoMetadataGateway({ ytdlpExecutable: 'yt-dlp' });
    const result = await gateway.analyzeVideo('https://youtu.be/abc');

    expect(result.title).toBe('My Video');
    expect(result.uploader).toBe('My Channel');
  });

  it('returns empty string when title is missing', async () => {
    succeed(JSON.stringify({ formats: [], uploader: 'Channel' }));
    const { createYtdlpVideoMetadataGateway } = await import(
      '@src/infrastructure/youtube/YtdlpVideoMetadataGateway'
    );
    const gateway = createYtdlpVideoMetadataGateway({ ytdlpExecutable: 'yt-dlp' });
    const result = await gateway.analyzeVideo('https://youtu.be/abc');

    expect(result.title).toBe('');
  });

  it('falls back to channel field when uploader is missing', async () => {
    succeed(JSON.stringify({ formats: [], title: 'T', channel: 'Fallback Channel' }));
    const { createYtdlpVideoMetadataGateway } = await import(
      '@src/infrastructure/youtube/YtdlpVideoMetadataGateway'
    );
    const gateway = createYtdlpVideoMetadataGateway({ ytdlpExecutable: 'yt-dlp' });
    const result = await gateway.analyzeVideo('https://youtu.be/abc');

    expect(result.uploader).toBe('Fallback Channel');
  });

  it('returns Unknown Channel when both uploader and channel are missing', async () => {
    succeed(JSON.stringify({ formats: [], title: 'T' }));
    const { createYtdlpVideoMetadataGateway } = await import(
      '@src/infrastructure/youtube/YtdlpVideoMetadataGateway'
    );
    const gateway = createYtdlpVideoMetadataGateway({ ytdlpExecutable: 'yt-dlp' });
    const result = await gateway.analyzeVideo('https://youtu.be/abc');

    expect(result.uploader).toBe('Unknown Channel');
  });

  it('returns videoQualities from mapYtdlpFormatsToQualityOptions', async () => {
    succeed(JSON.stringify({ formats: [] }));
    const { createYtdlpVideoMetadataGateway } = await import(
      '@src/infrastructure/youtube/YtdlpVideoMetadataGateway'
    );
    const gateway = createYtdlpVideoMetadataGateway({ ytdlpExecutable: 'yt-dlp' });
    const result = await gateway.analyzeVideo('https://youtu.be/abc');

    expect(result.videoQualities).toEqual([FAKE_VIDEO_QUALITY]);
  });

  it('returns audioQualities from mapYtdlpAudioFormatsToQualityOptions', async () => {
    succeed(JSON.stringify({ formats: [] }));
    const { createYtdlpVideoMetadataGateway } = await import(
      '@src/infrastructure/youtube/YtdlpVideoMetadataGateway'
    );
    const gateway = createYtdlpVideoMetadataGateway({ ytdlpExecutable: 'yt-dlp' });
    const result = await gateway.analyzeVideo('https://youtu.be/abc');

    expect(result.audioQualities).toEqual([FAKE_AUDIO_QUALITY]);
  });
});
