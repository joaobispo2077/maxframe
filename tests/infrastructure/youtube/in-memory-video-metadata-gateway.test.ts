import { createInMemoryVideoMetadataGateway } from '@src/infrastructure/youtube/InMemoryVideoMetadataGateway';
import { describe, expect, it } from 'vitest';

describe('createInMemoryVideoMetadataGateway', () => {
  it('returns default videoQualities with expected shape', async () => {
    const gateway = createInMemoryVideoMetadataGateway();
    const analysis = await gateway.analyzeVideo(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    );

    expect(analysis.videoQualities).toHaveLength(3);
    expect(analysis.videoQualities[0]?.formatId).toBe('137');
    expect(analysis.videoQualities.every((q) => q.hasVideo)).toBe(true);
  });

  it('returns injected options when provided', async () => {
    const gateway = createInMemoryVideoMetadataGateway([
      {
        formatId: 'only',
        container: 'webm',
        resolutionLabel: '480p',
        width: 854,
        height: 480,
        fps: 30,
        hasVideo: true,
        hasAudio: false,
      },
    ]);
    const analysis = await gateway.analyzeVideo('https://youtu.be/dQw4w9WgXcQ');

    expect(analysis.videoQualities).toHaveLength(1);
    expect(analysis.videoQualities[0]?.container).toBe('webm');
  });

  it('returns empty audioQualities by default', async () => {
    const gateway = createInMemoryVideoMetadataGateway();
    const analysis = await gateway.analyzeVideo(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    );
    expect(analysis.audioQualities).toEqual([]);
  });
});
