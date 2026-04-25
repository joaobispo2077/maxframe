import { createVideoUrl } from '@src/domain/video/VideoUrl';
import { describe, expect, it } from 'vitest';

describe('VideoUrl', () => {
  it('accepts a youtube url and returns parsed url', () => {
    const url = createVideoUrl('https://www.youtube.com/watch?v=abc');

    expect(url.hostname).toBe('www.youtube.com');
  });

  it('rejects malformed urls', () => {
    expect(() => createVideoUrl('not-a-url')).toThrowError(
      expect.objectContaining({
        name: 'InvalidVideoUrlError',
        message: 'Invalid URL format.',
      }),
    );
  });

  it('rejects non-youtube hosts', () => {
    expect(() => createVideoUrl('https://example.com/video')).toThrowError(
      expect.objectContaining({
        name: 'InvalidVideoUrlError',
        message: 'Only YouTube URLs are supported.',
      }),
    );
  });
});
