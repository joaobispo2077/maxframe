import { describe, expect, it } from 'vitest';

import { parseYoutubeVideoId } from '../../../src/domain/video/youtubeVideoId.js';

describe('parseYoutubeVideoId', () => {
  it('parses watch URLs', () => {
    const id = parseYoutubeVideoId(
      new URL('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
    );
    expect(id).toBe('dQw4w9WgXcQ');
  });

  it('parses youtu.be URLs', () => {
    const id = parseYoutubeVideoId(new URL('https://youtu.be/dQw4w9WgXcQ'));
    expect(id).toBe('dQw4w9WgXcQ');
  });

  it('parses shorts URLs', () => {
    const id = parseYoutubeVideoId(
      new URL('https://www.youtube.com/shorts/dQw4w9WgXcQ'),
    );
    expect(id).toBe('dQw4w9WgXcQ');
  });

  it('parses embed URLs', () => {
    const id = parseYoutubeVideoId(
      new URL('https://www.youtube.com/embed/dQw4w9WgXcQ'),
    );
    expect(id).toBe('dQw4w9WgXcQ');
  });

  it('returns undefined for non-youtube hosts', () => {
    expect(
      parseYoutubeVideoId(new URL('https://example.com/watch?v=dQw4w9WgXcQ')),
    ).toBeUndefined();
  });

  it('returns undefined when v param is not a valid id', () => {
    expect(
      parseYoutubeVideoId(new URL('https://www.youtube.com/watch?v=bad')),
    ).toBeUndefined();
  });

  it('parses m.youtube.com watch URLs', () => {
    const id = parseYoutubeVideoId(
      new URL('https://m.youtube.com/watch?v=dQw4w9WgXcQ'),
    );
    expect(id).toBe('dQw4w9WgXcQ');
  });

  it('parses music.youtube.com watch URLs', () => {
    const id = parseYoutubeVideoId(
      new URL('https://music.youtube.com/watch?v=dQw4w9WgXcQ'),
    );
    expect(id).toBe('dQw4w9WgXcQ');
  });

  it('parses live path segment', () => {
    const id = parseYoutubeVideoId(
      new URL('https://www.youtube.com/live/dQw4w9WgXcQ'),
    );
    expect(id).toBe('dQw4w9WgXcQ');
  });

  it('returns undefined for id longer than 11 characters', () => {
    expect(
      parseYoutubeVideoId(
        new URL(
          'https://www.youtube.com/watch?v=dQw4w9WgXcQextra',
        ),
      ),
    ).toBeUndefined();
  });
});
