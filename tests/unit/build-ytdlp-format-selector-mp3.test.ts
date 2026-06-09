import { buildYtdlpFormatSelector } from '@src/infrastructure/youtube/buildYtdlpFormatSelector';
import { describe, expect, it } from 'vitest';

describe('buildYtdlpFormatSelector — outputMode support', () => {
  it('returns bestaudio/best for mp3 mode regardless of hasAudio=false', () => {
    expect(buildYtdlpFormatSelector('137', false, 'mp3')).toBe(
      'bestaudio/best',
    );
  });

  it('returns bestaudio/best for mp3 mode regardless of hasAudio=true', () => {
    expect(buildYtdlpFormatSelector('137', true, 'mp3')).toBe('bestaudio/best');
  });

  it('returns AAC-preferring selector for mp4 mode when no audio', () => {
    expect(buildYtdlpFormatSelector('137', false, 'mp4')).toBe(
      '137+ba[acodec^=mp4a]/bestaudio[acodec^=mp4a]/bestaudio',
    );
  });

  it('returns just formatId for mp4 mode when has audio', () => {
    expect(buildYtdlpFormatSelector('137', true, 'mp4')).toBe('137');
  });
});
