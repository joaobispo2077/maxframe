import { describe, expect, it } from 'vitest';

import { InvalidVideoUrlError, createVideoUrl } from '../../../src/domain/video/VideoUrl.js';

describe('VideoUrl', () => {
  it('accepts a youtube url and returns parsed url', () => {
    const url = createVideoUrl('https://www.youtube.com/watch?v=abc');

    expect(url.hostname).toBe('www.youtube.com');
  });

  it('rejects malformed urls', () => {
    expect(() => createVideoUrl('not-a-url')).toThrowError(
      new InvalidVideoUrlError('Invalid URL format.'),
    );
  });

  it('rejects non-youtube hosts', () => {
    expect(() => createVideoUrl('https://example.com/video')).toThrowError(
      new InvalidVideoUrlError('Only YouTube URLs are supported.'),
    );
  });
});

