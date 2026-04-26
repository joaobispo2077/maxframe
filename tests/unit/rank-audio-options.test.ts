import type { QualityOption } from '@src/domain/quality/QualityOption';

import {
  rankAudioOptions,
  selectBestAudioQuality,
} from '@src/domain/quality/QualityRankingPolicy';
import { describe, expect, it } from 'vitest';

function makeAudio(formatId: string, audioBitrateKbps?: number): QualityOption {
  return {
    formatId,
    container: 'webm',
    resolutionLabel: 'Audio-only',
    width: 0,
    height: 0,
    fps: 0,
    hasVideo: false,
    hasAudio: true,
    audioBitrateKbps,
  };
}

function makeVideo(formatId: string): QualityOption {
  return {
    formatId,
    container: 'mp4',
    resolutionLabel: '1080p',
    width: 1920,
    height: 1080,
    fps: 30,
    hasVideo: true,
    hasAudio: false,
  };
}

describe('rankAudioOptions', () => {
  it('sorts audio-only options by audioBitrateKbps descending', () => {
    const options = [
      makeAudio('low', 64),
      makeAudio('high', 256),
      makeAudio('mid', 128),
    ];
    const ranked = rankAudioOptions(options);
    expect(ranked.map((o) => o.formatId)).toEqual(['high', 'mid', 'low']);
  });

  it('filters out video formats', () => {
    const options = [makeAudio('audio1', 128), makeVideo('video1')];
    const ranked = rankAudioOptions(options);
    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.formatId).toBe('audio1');
  });

  it('returns empty array for empty input', () => {
    expect(rankAudioOptions([])).toEqual([]);
  });

  it('treats undefined audioBitrateKbps as 0 for sorting', () => {
    const options = [makeAudio('nobitrate'), makeAudio('has', 64)];
    const ranked = rankAudioOptions(options);
    expect(ranked[0]?.formatId).toBe('has');
    expect(ranked[1]?.formatId).toBe('nobitrate');
  });
});

describe('selectBestAudioQuality', () => {
  it('returns the highest bitrate audio option', () => {
    const options = [makeAudio('a', 128), makeAudio('b', 256), makeAudio('c', 64)];
    expect(selectBestAudioQuality(options)?.formatId).toBe('b');
  });

  it('returns undefined when no audio options', () => {
    expect(selectBestAudioQuality([])).toBeUndefined();
  });

  it('returns undefined when only video options', () => {
    expect(selectBestAudioQuality([makeVideo('v1')])).toBeUndefined();
  });
});
