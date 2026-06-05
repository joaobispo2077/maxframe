import { resolveBestDownload } from '@ui/lib/resolveBestDownload';
import { describe, expect, it } from 'vitest';

const BASE_RESULT = {
  url: 'https://www.youtube.com/watch?v=vid',
  videoId: 'vid',
  title: 'T',
  uploader: 'U',
  qualities: [
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
  ],
  bestQuality: {
    formatId: '137',
    container: 'mp4',
    resolutionLabel: '1080p',
    width: 1920,
    height: 1080,
    fps: 30,
    hasVideo: true,
    hasAudio: false,
  },
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
  bestAudioQuality: {
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
};

describe('resolveBestDownload', () => {
  it('resolves best video for mp4 mode', () => {
    const target = resolveBestDownload(BASE_RESULT, 'mp4');
    expect(target?.formatId).toBe('137');
    expect(target?.hasAudio).toBe(false);
  });

  it('resolves best audio for mp3 mode', () => {
    const target = resolveBestDownload(BASE_RESULT, 'mp3');
    expect(target?.formatId).toBe('251');
    expect(target?.hasAudio).toBe(true);
  });

  it('falls back to video extraction when no audio streams exist', () => {
    const target = resolveBestDownload(
      {
        ...BASE_RESULT,
        audioQualities: [],
        bestAudioQuality: undefined,
      },
      'mp3',
    );
    expect(target?.formatId).toBe('137');
    expect(target?.label).toContain('best audio');
  });
});
