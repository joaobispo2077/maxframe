import { ytdlpDownloadNeedsFfmpeg } from '@src/infrastructure/youtube/ytdlpDownloadNeedsFfmpeg';
import { describe, expect, it } from 'vitest';

describe('ytdlpDownloadNeedsFfmpeg', () => {
  it('requires ffmpeg for video-only MP4 downloads', () => {
    expect(ytdlpDownloadNeedsFfmpeg(false, 'mp4')).toBe(true);
  });

  it('requires ffmpeg for muxed MP4 downloads', () => {
    expect(ytdlpDownloadNeedsFfmpeg(true, 'mp4')).toBe(true);
  });

  it('requires ffmpeg for MP3 downloads', () => {
    expect(ytdlpDownloadNeedsFfmpeg(true, 'mp3')).toBe(true);
  });
});
