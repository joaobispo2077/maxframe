import { mapYtdlpFormatsToQualityOptions } from '@src/infrastructure/youtube/mapYtdlpFormatsToQualityOptions';
import { describe, expect, it } from 'vitest';

describe('mapYtdlpFormatsToQualityOptions', () => {
  it('maps video formats and skips audio-only', () => {
    const qualities = mapYtdlpFormatsToQualityOptions({
      formats: [
        {
          format_id: '140',
          ext: 'm4a',
          vcodec: 'none',
          acodec: 'mp4a.40.2',
          abr: 128,
        },
        {
          format_id: '137',
          ext: 'mp4',
          width: 1920,
          height: 1080,
          fps: 30,
          vcodec: 'avc1.640028',
          acodec: 'none',
          vbr: 4200,
          format_note: '1080p',
        },
      ],
    });

    expect(qualities).toHaveLength(1);
    expect(qualities[0]).toMatchObject({
      formatId: '137',
      container: 'mp4',
      resolutionLabel: '1080p',
      width: 1920,
      height: 1080,
      fps: 30,
      hasVideo: true,
      hasAudio: false,
      videoBitrateKbps: 4200,
    });
  });

  it('dedupes repeated format_id', () => {
    const row = {
      format_id: '22',
      ext: 'mp4',
      width: 1280,
      height: 720,
      fps: 30,
      vcodec: 'avc1',
      acodec: 'mp4a',
    };
    const qualities = mapYtdlpFormatsToQualityOptions({
      formats: [row, row],
    });
    expect(qualities).toHaveLength(1);
  });

  it('returns empty for non-object or missing formats', () => {
    expect(mapYtdlpFormatsToQualityOptions(null)).toEqual([]);
    expect(mapYtdlpFormatsToQualityOptions({})).toEqual([]);
    expect(mapYtdlpFormatsToQualityOptions({ formats: 'x' })).toEqual([]);
  });

  it('uses height-based label when format_note is not a resolution token', () => {
    const qualities = mapYtdlpFormatsToQualityOptions({
      formats: [
        {
          format_id: '401',
          ext: 'mp4',
          width: 3840,
          height: 2160,
          fps: 60,
          vcodec: 'av01',
          acodec: 'none',
          format_note: 'Premium',
        },
      ],
    });
    expect(qualities[0]?.resolutionLabel).toBe('2160p');
  });

  it('defaults fps to 30 when absent', () => {
    const qualities = mapYtdlpFormatsToQualityOptions({
      formats: [
        {
          format_id: '18',
          ext: 'mp4',
          width: 640,
          height: 360,
          vcodec: 'avc1',
          acodec: 'mp4a',
        },
      ],
    });
    expect(qualities[0]?.fps).toBe(30);
  });
});
