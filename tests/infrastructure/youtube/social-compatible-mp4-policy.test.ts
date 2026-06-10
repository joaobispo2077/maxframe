import {
  SOCIAL_COMPATIBLE_AUDIO_MERGE_SELECTOR,
  SOCIAL_COMPATIBLE_FORMAT_SORT,
  SOCIAL_COMPATIBLE_VIDEO_CONVERTOR_PPA,
  buildSocialCompatibleVideoOnlySelector,
  socialCompatibleMp4YtdlpArgPairs,
} from '@src/infrastructure/youtube/socialCompatibleMp4Policy';
import { describe, expect, it } from 'vitest';

describe('socialCompatibleMp4Policy', () => {
  it('defines AAC-preferring audio merge selector', () => {
    expect(SOCIAL_COMPATIBLE_AUDIO_MERGE_SELECTOR).toBe(
      'ba[acodec^=mp4a]/bestaudio[acodec^=mp4a]/bestaudio',
    );
  });

  it('defines H.264 + AAC format sort', () => {
    expect(SOCIAL_COMPATIBLE_FORMAT_SORT).toBe('vcodec:h264,acodec:aac');
  });

  it('defines VideoConvertor post-processor args for social-compatible MP4', () => {
    expect(SOCIAL_COMPATIBLE_VIDEO_CONVERTOR_PPA).toContain('-c:v copy');
    expect(SOCIAL_COMPATIBLE_VIDEO_CONVERTOR_PPA).toContain('-c:a aac');
    expect(SOCIAL_COMPATIBLE_VIDEO_CONVERTOR_PPA).toContain('-b:a 128k');
    expect(SOCIAL_COMPATIBLE_VIDEO_CONVERTOR_PPA).toContain(
      '-movflags +faststart',
    );
  });

  it('builds video-only selector with AAC preference', () => {
    expect(buildSocialCompatibleVideoOnlySelector('135')).toBe(
      '135+ba[acodec^=mp4a]/bestaudio[acodec^=mp4a]/bestaudio',
    );
  });

  it('returns ordered yt-dlp arg pairs for social-compatible MP4', () => {
    expect(socialCompatibleMp4YtdlpArgPairs()).toEqual([
      ['-S', 'vcodec:h264,acodec:aac'],
      ['--recode-video', 'mp4'],
      ['--ppa', SOCIAL_COMPATIBLE_VIDEO_CONVERTOR_PPA],
      ['--merge-output-format', 'mp4'],
    ]);
  });
});
