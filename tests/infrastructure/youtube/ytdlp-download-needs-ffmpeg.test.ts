import { ytdlpDownloadNeedsFfmpeg } from '@src/infrastructure/youtube/ytdlpDownloadNeedsFfmpeg';
import { describe, expect, it } from 'vitest';

describe('ytdlpDownloadNeedsFfmpeg', () => {
  it('requires ffmpeg when selected format has no audio', () => {
    expect(ytdlpDownloadNeedsFfmpeg(false)).toBe(true);
  });

  it('does not require ffmpeg when selected format already has audio', () => {
    expect(ytdlpDownloadNeedsFfmpeg(true)).toBe(false);
  });
});
