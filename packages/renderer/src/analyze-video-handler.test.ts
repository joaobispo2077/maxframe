import { describe, expect, it } from 'vitest';

import { analyzeVideoHandler } from '../../../src/interface/ipc/analyzeVideoHandler.js';

describe('analyzeVideoHandler', () => {
  it('returns ranked qualities from the wired use case', async () => {
    const result = await analyzeVideoHandler(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    );

    expect(result.videoId).toBe('dQw4w9WgXcQ');
    expect(result.qualities.length).toBeGreaterThan(0);
    expect(result.bestQuality?.formatId).toBeDefined();
  });
});
