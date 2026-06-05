import { buildSuggestedFileName } from '@ui/lib/buildSuggestedFileName';
import { describe, expect, it } from 'vitest';

describe('buildSuggestedFileName', () => {
  it('builds mp4 filename from title and uploader', () => {
    const name = buildSuggestedFileName({
      title: 'My Video',
      uploader: 'My Channel',
      videoId: 'vid',
      outputMode: 'mp4',
    });
    expect(name).toBe('My Video - My Channel.mp4');
  });

  it('builds mp3 filename with mp3 extension', () => {
    const name = buildSuggestedFileName({
      title: 'Song',
      uploader: 'Artist',
      outputMode: 'mp3',
    });
    expect(name).toBe('Song - Artist.mp3');
  });

  it('strips invalid path characters and collapses whitespace', () => {
    const name = buildSuggestedFileName({
      title: 'Bad: Title?*',
      uploader: 'Ch|annel',
      outputMode: 'mp4',
    });
    expect(name).toBe('Bad Title - Channel.mp4');
  });

  it('falls back to videoId when title missing', () => {
    const name = buildSuggestedFileName({
      videoId: 'abc123',
      outputMode: 'mp4',
    });
    expect(name).toBe('abc123 - Unknown Channel.mp4');
  });
});
