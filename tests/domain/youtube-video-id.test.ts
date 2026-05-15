import {
  canonicalYoutubeWatchUrl,
  parseYoutubeVideoId,
} from '@src/domain/video/youtubeVideoId';
import { describe, expect, it } from 'vitest';

describe('canonicalYoutubeWatchUrl', () => {
  it('normalizes shorts URLs to watch?v=', () => {
    expect(
      canonicalYoutubeWatchUrl(
        new URL('https://www.youtube.com/shorts/dQw4w9WgXcQ'),
      ),
    ).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });

  it('normalizes youtu.be URLs to watch?v=', () => {
    expect(
      canonicalYoutubeWatchUrl(new URL('https://youtu.be/dQw4w9WgXcQ')),
    ).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });

  it('normalizes embed URLs to watch?v=', () => {
    expect(
      canonicalYoutubeWatchUrl(
        new URL('https://www.youtube.com/embed/dQw4w9WgXcQ'),
      ),
    ).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });

  it('normalizes live URLs to watch?v=', () => {
    expect(
      canonicalYoutubeWatchUrl(
        new URL('https://www.youtube.com/live/dQw4w9WgXcQ'),
      ),
    ).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });

  it('leaves valid watch URLs as canonical watch?v=', () => {
    expect(
      canonicalYoutubeWatchUrl(
        new URL('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
      ),
    ).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });

  it('returns original URL when v param is not a valid id', () => {
    const url = new URL('https://www.youtube.com/watch?v=bad');
    expect(canonicalYoutubeWatchUrl(url)).toBe(url.toString());
  });

  it('strips playlist and radio query params from watch URLs', () => {
    expect(
      canonicalYoutubeWatchUrl(
        new URL(
          'https://www.youtube.com/watch?v=Zt62nsFLqA0&list=RDZt62nsFLqA0&start_radio=1',
        ),
      ),
    ).toBe('https://www.youtube.com/watch?v=Zt62nsFLqA0');
  });
});

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
        new URL('https://www.youtube.com/watch?v=dQw4w9WgXcQextra'),
      ),
    ).toBeUndefined();
  });
});
