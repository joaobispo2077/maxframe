import { describe, expect, it } from 'vitest';

import { rankQualityOptions, selectBestQuality } from '../../../src/domain/quality/QualityRankingPolicy.js';
import type { QualityOption } from '../../../src/domain/quality/QualityOption.js';

describe('QualityRankingPolicy', () => {
  it('prioritizes higher vertical resolution first', () => {
    const options: QualityOption[] = [
      {
        formatId: '720',
        container: 'mp4',
        resolutionLabel: '720p',
        width: 1280,
        height: 720,
        fps: 60,
        hasVideo: true,
        hasAudio: false,
        videoBitrateKbps: 9000,
      },
      {
        formatId: '1080',
        container: 'mp4',
        resolutionLabel: '1080p',
        width: 1920,
        height: 1080,
        fps: 30,
        hasVideo: true,
        hasAudio: false,
        videoBitrateKbps: 3000,
      },
    ];

    expect(selectBestQuality(options)?.formatId).toBe('1080');
    expect(rankQualityOptions(options).map((q) => q.formatId)).toEqual([
      '1080',
      '720',
    ]);
  });

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

  it('breaks ties using higher bitrate after same resolution and fps', () => {
    const options: QualityOption[] = [
      {
        formatId: 'x-low',
        container: 'mp4',
        resolutionLabel: '1080p',
        width: 1920,
        height: 1080,
        fps: 30,
        hasVideo: true,
        hasAudio: false,
        videoBitrateKbps: 3200,
      },
      {
        formatId: 'x-high',
        container: 'mp4',
        resolutionLabel: '1080p',
        width: 1920,
        height: 1080,
        fps: 30,
        hasVideo: true,
        hasAudio: false,
        videoBitrateKbps: 4200,
      },
    ];

    expect(selectBestQuality(options)?.formatId).toBe('x-high');
  });

  it('treats missing bitrate as zero when comparing equal resolution and fps', () => {
    const options: QualityOption[] = [
      {
        formatId: 'a',
        container: 'mp4',
        resolutionLabel: '720p',
        width: 1280,
        height: 720,
        fps: 30,
        hasVideo: true,
        hasAudio: false,
      },
      {
        formatId: 'b',
        container: 'mp4',
        resolutionLabel: '720p',
        width: 1280,
        height: 720,
        fps: 30,
        hasVideo: true,
        hasAudio: false,
        videoBitrateKbps: 1,
      },
    ];

    expect(selectBestQuality(options)?.formatId).toBe('b');
  });
});

