import { buildYtdlpFormatSelector } from '@src/infrastructure/youtube/buildYtdlpFormatSelector';
import { buildSocialCompatibleVideoOnlySelector } from '@src/infrastructure/youtube/socialCompatibleMp4Policy';
import { resolveYtdlpExecutable } from '@src/infrastructure/youtube/resolveYtdlpExecutable';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('buildYtdlpFormatSelector', () => {
  it('returns format id only when audio is present', () => {
    expect(buildYtdlpFormatSelector('22', true, 'mp4')).toBe('22');
  });

  it('merges AAC-preferring audio when row is video-only and outputMode is mp4', () => {
    expect(buildYtdlpFormatSelector('137', false, 'mp4')).toBe(
      buildSocialCompatibleVideoOnlySelector('137'),
    );
  });
});

describe('buildYtdlpFormatSelector — social-compatible MP4', () => {
  it('prefers AAC audio for video-only MP4 downloads', () => {
    expect(buildYtdlpFormatSelector('135', false, 'mp4')).toBe(
      '135+ba[acodec^=mp4a]/bestaudio[acodec^=mp4a]/bestaudio',
    );
  });

  it('returns format id only for muxed MP4 rows', () => {
    expect(buildYtdlpFormatSelector('22', true, 'mp4')).toBe('22');
  });

  it('returns bestaudio/best for MP3 mode', () => {
    expect(buildYtdlpFormatSelector('135', false, 'mp3')).toBe(
      'bestaudio/best',
    );
  });
});

describe('resolveYtdlpExecutable', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.YT_DLP_PATH;
  });

  it('prefers YT_DLP_PATH when set', () => {
    process.env.YT_DLP_PATH = 'C:\\tools\\yt-dlp.exe';
    expect(resolveYtdlpExecutable()).toBe('C:\\tools\\yt-dlp.exe');
  });

  it('falls back to yt-dlp on PATH when no env or bundle', () => {
    expect(resolveYtdlpExecutable()).toBe('yt-dlp');
  });
});
