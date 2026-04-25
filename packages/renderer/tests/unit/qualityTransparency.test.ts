import { describe, expect, it } from 'vitest';

import type { QualityOption } from '../../../../src/domain/quality/QualityOption.js';

import {
  describeQualityAgainstBest,
  formatAudioBitrateKbps,
  formatVideoBitrateKbps,
  streamKindLabel,
} from '../../src/lib/qualityTransparency.js';

const base: QualityOption = {
  formatId: '137',
  container: 'mp4',
  resolutionLabel: '1080p',
  width: 1920,
  height: 1080,
  fps: 30,
  hasVideo: true,
  hasAudio: false,
  videoBitrateKbps: 4200,
};

describe('formatVideoBitrateKbps', () => {
  it('formats finite kbps', () => {
    expect(formatVideoBitrateKbps(4200.4)).toBe('~4200 kbps video');
  });
  it('returns null when missing', () => {
    expect(formatVideoBitrateKbps(undefined)).toBeNull();
  });
});

describe('formatAudioBitrateKbps', () => {
  it('formats finite kbps', () => {
    expect(formatAudioBitrateKbps(128)).toBe('~128 kbps audio');
  });
});

describe('streamKindLabel', () => {
  it('describes video-only', () => {
    expect(streamKindLabel(base)).toContain('Video only');
  });
  it('describes combined', () => {
    expect(
      streamKindLabel({ ...base, hasAudio: true, formatId: '22' }),
    ).toContain('Video + audio');
  });
});

describe('describeQualityAgainstBest', () => {
  const best: QualityOption = {
    ...base,
    formatId: 'best',
    height: 1080,
    fps: 60,
    videoBitrateKbps: 5000,
  };

  it('handles missing best', () => {
    expect(describeQualityAgainstBest(base, undefined)).toContain(
      'No top-ranked',
    );
  });

  it('same format as best', () => {
    expect(describeQualityAgainstBest(best, best)).toContain('top-ranked');
  });

  it('lower height', () => {
    const row = { ...base, formatId: '720', height: 720 };
    expect(describeQualityAgainstBest(row, best)).toContain('Lower vertical');
  });

  it('same height lower fps', () => {
    const row = { ...best, formatId: 'other', fps: 30 };
    expect(describeQualityAgainstBest(row, best)).toContain('lower frame rate');
  });

  it('same height and fps lower bitrate', () => {
    const row = {
      ...best,
      formatId: 'other',
      videoBitrateKbps: 1000,
    };
    expect(describeQualityAgainstBest(row, best)).toContain('bitrate');
  });
});
