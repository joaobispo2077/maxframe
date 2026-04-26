import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('analyzeVideoHandler default gateway', () => {
  const originalFakeFlag = process.env.MAXFRAME_FAKE_VIDEO_METADATA;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    if (originalFakeFlag === undefined) {
      delete process.env.MAXFRAME_FAKE_VIDEO_METADATA;
    } else {
      process.env.MAXFRAME_FAKE_VIDEO_METADATA = originalFakeFlag;
    }
  });

  it('uses in-memory metadata gateway when MAXFRAME_FAKE_VIDEO_METADATA is enabled', async () => {
    process.env.MAXFRAME_FAKE_VIDEO_METADATA = '1';
    const { analyzeVideoHandler } = await import(
      '@src/interface/ipc/analyzeVideoHandler'
    );

    const result = await analyzeVideoHandler(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    );

    expect(result.videoId).toBe('dQw4w9WgXcQ');
    expect(result.qualities.length).toBeGreaterThan(0);
    expect(result.bestQuality?.formatId).toBeDefined();
  });

  it('uses yt-dlp gateway when fake metadata flag is disabled', async () => {
    process.env.MAXFRAME_FAKE_VIDEO_METADATA = '0';
    const analyzeVideo = vi.fn().mockResolvedValue({
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
      title: 'Test',
      uploader: 'Tester',
    });

    vi.doMock('@src/infrastructure/youtube/YtdlpVideoMetadataGateway', () => ({
      createYtdlpVideoMetadataGateway: () => ({
        analyzeVideo,
      }),
    }));

    const { analyzeVideoHandler } = await import(
      '@src/interface/ipc/analyzeVideoHandler'
    );
    const result = await analyzeVideoHandler(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    );

    expect(analyzeVideo).toHaveBeenCalledWith(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    );
    expect(result.videoId).toBe('dQw4w9WgXcQ');
    expect(result.bestQuality?.formatId).toBe('137');
  });
});
