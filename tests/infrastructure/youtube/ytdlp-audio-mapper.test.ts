import { mapYtdlpAudioFormatsToQualityOptions } from '@src/infrastructure/youtube/mapYtdlpAudioFormatsToQualityOptions';
import { describe, expect, it } from 'vitest';

describe('mapYtdlpAudioFormatsToQualityOptions', () => {
  it('returns empty array for non-record input', () => {
    expect(mapYtdlpAudioFormatsToQualityOptions(null)).toEqual([]);
    expect(mapYtdlpAudioFormatsToQualityOptions('string')).toEqual([]);
    expect(mapYtdlpAudioFormatsToQualityOptions(42)).toEqual([]);
  });

  it('returns empty array when formats key is missing', () => {
    expect(mapYtdlpAudioFormatsToQualityOptions({})).toEqual([]);
  });

  it('returns empty array when formats is not an array', () => {
    expect(
      mapYtdlpAudioFormatsToQualityOptions({ formats: 'not-array' }),
    ).toEqual([]);
  });

  it('skips entries without format_id', () => {
    const payload = {
      formats: [{ acodec: 'opus', vcodec: 'none', ext: 'webm' }],
    };
    expect(mapYtdlpAudioFormatsToQualityOptions(payload)).toEqual([]);
  });

  it('skips entries where vcodec is not none (video formats)', () => {
    const payload = {
      formats: [
        {
          format_id: '137',
          vcodec: 'avc1.4d401f',
          acodec: 'none',
          ext: 'mp4',
        },
      ],
    };
    expect(mapYtdlpAudioFormatsToQualityOptions(payload)).toEqual([]);
  });

  it('skips entries where acodec is none (no audio)', () => {
    const payload = {
      formats: [
        {
          format_id: '169',
          vcodec: 'none',
          acodec: 'none',
          ext: 'webm',
        },
      ],
    };
    expect(mapYtdlpAudioFormatsToQualityOptions(payload)).toEqual([]);
  });

  it('maps a valid audio-only entry correctly', () => {
    const payload = {
      formats: [
        {
          format_id: '251',
          vcodec: 'none',
          acodec: 'opus',
          ext: 'webm',
          abr: 160,
        },
      ],
    };
    const result = mapYtdlpAudioFormatsToQualityOptions(payload);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      formatId: '251',
      container: 'webm',
      resolutionLabel: 'Audio-only',
      width: 0,
      height: 0,
      fps: 0,
      hasVideo: false,
      hasAudio: true,
      audioBitrateKbps: 160,
    });
  });

  it('deduplicates entries by formatId', () => {
    const payload = {
      formats: [
        {
          format_id: '251',
          vcodec: 'none',
          acodec: 'opus',
          ext: 'webm',
          abr: 128,
        },
        {
          format_id: '251',
          vcodec: 'none',
          acodec: 'opus',
          ext: 'webm',
          abr: 256,
        },
      ],
    };
    const result = mapYtdlpAudioFormatsToQualityOptions(payload);
    expect(result).toHaveLength(1);
    expect(result[0]?.formatId).toBe('251');
  });

  it('handles multiple valid audio entries', () => {
    const payload = {
      formats: [
        {
          format_id: '251',
          vcodec: 'none',
          acodec: 'opus',
          ext: 'webm',
          abr: 160,
        },
        {
          format_id: '140',
          vcodec: 'none',
          acodec: 'mp4a.40.2',
          ext: 'm4a',
          abr: 128,
        },
      ],
    };
    const result = mapYtdlpAudioFormatsToQualityOptions(payload);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.formatId)).toContain('251');
    expect(result.map((r) => r.formatId)).toContain('140');
  });
});
