import type { VideoAnalysis, VideoMetadataGateway } from '@src/application/ports/VideoMetadataGateway';

import { createAnalyzeVideoUrlUseCase } from '@src/application/use-cases/AnalyzeVideoUrlUseCase';
import { describe, expect, it } from 'vitest';

function makeGateway(analysis: VideoAnalysis): VideoMetadataGateway {
  return {
    analyzeVideo: async () => analysis,
  };
}

const BASE_ANALYSIS: VideoAnalysis = {
  title: 'Test Video',
  uploader: 'Test Channel',
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
      videoBitrateKbps: 4200,
    },
  ],
  audioQualities: [
    {
      formatId: '251',
      container: 'webm',
      resolutionLabel: 'Audio-only',
      width: 0,
      height: 0,
      fps: 0,
      hasVideo: false,
      hasAudio: true,
      audioBitrateKbps: 160,
    },
  ],
};

describe('AnalyzeVideoUrlUseCase — audio enrichment', () => {
  it('propagates title and uploader from gateway analysis', async () => {
    const analyzeVideoUrl = createAnalyzeVideoUrlUseCase(makeGateway(BASE_ANALYSIS));
    const result = await analyzeVideoUrl(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    );

    expect(result.title).toBe('Test Video');
    expect(result.uploader).toBe('Test Channel');
  });

  it('includes audioQualities in result', async () => {
    const analyzeVideoUrl = createAnalyzeVideoUrlUseCase(makeGateway(BASE_ANALYSIS));
    const result = await analyzeVideoUrl(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    );

    expect(result.audioQualities).toHaveLength(1);
    expect(result.audioQualities[0]?.formatId).toBe('251');
  });

  it('includes bestAudioQuality as the highest bitrate audio option', async () => {
    const analysis: VideoAnalysis = {
      ...BASE_ANALYSIS,
      audioQualities: [
        { ...BASE_ANALYSIS.audioQualities[0]!, formatId: 'low', audioBitrateKbps: 64 },
        { ...BASE_ANALYSIS.audioQualities[0]!, formatId: 'high', audioBitrateKbps: 256 },
      ],
    };
    const analyzeVideoUrl = createAnalyzeVideoUrlUseCase(makeGateway(analysis));
    const result = await analyzeVideoUrl(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    );

    expect(result.bestAudioQuality?.formatId).toBe('high');
  });

  it('bestAudioQuality is undefined when audioQualities is empty', async () => {
    const analysis: VideoAnalysis = { ...BASE_ANALYSIS, audioQualities: [] };
    const analyzeVideoUrl = createAnalyzeVideoUrlUseCase(makeGateway(analysis));
    const result = await analyzeVideoUrl(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    );

    expect(result.bestAudioQuality).toBeUndefined();
  });

  it('still returns ranked videoQualities from analysis.videoQualities', async () => {
    const analysis: VideoAnalysis = {
      ...BASE_ANALYSIS,
      videoQualities: [
        { formatId: '137', container: 'mp4', resolutionLabel: '1080p', width: 1920, height: 1080, fps: 30, hasVideo: true, hasAudio: false },
        { formatId: '299', container: 'mp4', resolutionLabel: '1080p60', width: 1920, height: 1080, fps: 60, hasVideo: true, hasAudio: false },
      ],
    };
    const analyzeVideoUrl = createAnalyzeVideoUrlUseCase(makeGateway(analysis));
    const result = await analyzeVideoUrl(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    );

    expect(result.qualities.map((q) => q.formatId)).toEqual(['299', '137']);
    expect(result.bestQuality?.formatId).toBe('299');
  });
});
