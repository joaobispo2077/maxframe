import type { QualityOption } from '@src/domain/quality/QualityOption';
import type { VideoMetadataGateway } from '@src/application/ports/VideoMetadataGateway';

import { createAnalyzeVideoUrlUseCase } from '@src/application/use-cases/AnalyzeVideoUrlUseCase';
import { describe, expect, it } from 'vitest';

function gatewayWith(videoQualities: QualityOption[]): VideoMetadataGateway {
  return {
    analyzeVideo: async () => ({
      videoQualities,
      audioQualities: [],
      title: '',
      uploader: 'Unknown Channel',
    }),
  };
}

const emptyGateway: VideoMetadataGateway = {
  analyzeVideo: async () => ({ videoQualities: [], audioQualities: [], title: '', uploader: 'Unknown Channel' }),
};

describe('AnalyzeVideoUrlUseCase', () => {
  it('returns ranked qualities and best quality', async () => {
    const gateway = gatewayWith([
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
      {
        formatId: '299',
        container: 'mp4',
        resolutionLabel: '1080p60',
        width: 1920,
        height: 1080,
        fps: 60,
        hasVideo: true,
        hasAudio: false,
      },
    ]);
    const analyzeVideoUrl = createAnalyzeVideoUrlUseCase(gateway);

    const result = await analyzeVideoUrl(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    );

    expect(result.videoId).toBe('dQw4w9WgXcQ');
    expect(result.bestQuality?.formatId).toBe('299');
    expect(result.qualities.map((quality) => quality.formatId)).toEqual([
      '299',
      '137',
    ]);
  });

  it('rejects non-youtube urls', async () => {
    const analyzeVideoUrl = createAnalyzeVideoUrlUseCase(emptyGateway);

    await expect(
      analyzeVideoUrl('https://example.com/not-youtube'),
    ).rejects.toMatchObject({
      name: 'AnalyzeVideoUrlError',
      code: 'INVALID_URL',
      message: 'Only YouTube URLs are supported.',
    });
  });

  it('rejects malformed urls', async () => {
    const analyzeVideoUrl = createAnalyzeVideoUrlUseCase(emptyGateway);

    await expect(analyzeVideoUrl('not-a-url')).rejects.toMatchObject({
      name: 'AnalyzeVideoUrlError',
      code: 'INVALID_URL',
      message: 'Invalid URL format.',
    });
  });

  it('returns undefined videoId when the v parameter is not a valid id', async () => {
    const analyzeVideoUrl = createAnalyzeVideoUrlUseCase(emptyGateway);

    const result = await analyzeVideoUrl(
      'https://www.youtube.com/watch?v=not11chars',
    );

    expect(result.videoId).toBeUndefined();
    expect(result.qualities).toEqual([]);
  });

  it('maps metadata provider failures to typed user-safe errors', async () => {
    const gateway: VideoMetadataGateway = {
      analyzeVideo: async () => {
        throw new Error('network down');
      },
    };
    const analyzeVideoUrl = createAnalyzeVideoUrlUseCase(gateway);

    await expect(
      analyzeVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
    ).rejects.toMatchObject({
      name: 'AnalyzeVideoUrlError',
      code: 'METADATA_UNAVAILABLE',
      message: 'Could not analyze this video right now. Please try again.',
    });
  });
});
