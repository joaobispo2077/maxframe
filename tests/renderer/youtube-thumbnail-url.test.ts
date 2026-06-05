import { youtubeThumbnailUrl } from '@ui/lib/youtubeThumbnailUrl';
import { describe, expect, it } from 'vitest';

describe('youtubeThumbnailUrl', () => {
  it('builds hqdefault thumbnail URL from video id', () => {
    expect(youtubeThumbnailUrl('dQw4w9WgXcQ')).toBe(
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    );
  });
});
