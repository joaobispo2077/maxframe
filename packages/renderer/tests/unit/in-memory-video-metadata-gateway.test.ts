import { describe, expect, it } from 'vitest';

import { createInMemoryVideoMetadataGateway } from '../../../../src/infrastructure/youtube/InMemoryVideoMetadataGateway.js';

describe('createInMemoryVideoMetadataGateway', () => {
  it('returns default qualities with expected shape', async () => {
    const gateway = createInMemoryVideoMetadataGateway();
    const qualities = await gateway.analyzeVideo(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    );

    expect(qualities).toHaveLength(3);
    expect(qualities[0]?.formatId).toBe('137');
    expect(qualities.every((q) => q.hasVideo)).toBe(true);
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
    const qualities = await gateway.analyzeVideo(
      'https://youtu.be/dQw4w9WgXcQ',
    );

    expect(qualities).toHaveLength(1);
    expect(qualities[0]?.container).toBe('webm');
  });
});
