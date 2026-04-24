import { describe, expect, it } from 'vitest';

import { rankQualityOptions, selectBestQuality } from '../../../src/domain/quality/QualityRankingPolicy.js';
import type { QualityOption } from '../../../src/domain/quality/QualityOption.js';

describe('QualityRankingPolicy', () => {
  it('prioritizes higher fps when resolution is equal', () => {
    const options: QualityOption[] = [
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
    ];

    const ranked = rankQualityOptions(options);

    expect(ranked[0]?.formatId).toBe('299');
    expect(selectBestQuality(options)?.formatId).toBe('299');
  });

  it('filters out non-video options', () => {
    const options: QualityOption[] = [
      {
        formatId: '140',
        container: 'm4a',
        resolutionLabel: 'audio',
        width: 0,
        height: 0,
        fps: 0,
        hasVideo: false,
        hasAudio: true,
      },
    ];

    expect(rankQualityOptions(options)).toHaveLength(0);
    expect(selectBestQuality(options)).toBeUndefined();
  });
});

