import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const analyzeVideo = vi.fn();

vi.mock('@src/infrastructure/youtube/YtdlpVideoMetadataGateway', () => ({
  createYtdlpVideoMetadataGateway: () => ({
    analyzeVideo,
  }),
}));

const WATCH_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

async function analyzeVideoHandler(url: string) {
  const loaded = await import('@src/interface/ipc/analyzeVideoHandler.js');
  return loaded.analyzeVideoHandler(url);
}

describe('analyzeVideoHandler e2e fixture hook', () => {
  let root: string;
  let fixturePath: string;
  const originalFake = process.env.MAXFRAME_FAKE_VIDEO_METADATA;

  beforeEach(() => {
    delete process.env.MAXFRAME_E2E;
    delete process.env.MAXFRAME_E2E_FIXTURE;
    delete process.env.MAXFRAME_FAKE_VIDEO_METADATA;
    root = mkdtempSync(join(tmpdir(), 'maxframe-e2e-analyze-'));
    fixturePath = join(root, 'sample.mp4');
    writeFileSync(fixturePath, 'fixture');
    analyzeVideo.mockReset();
    analyzeVideo.mockResolvedValue({
      videoQualities: [
        {
          formatId: '0',
          container: 'mp4',
          resolutionLabel: '120p',
          width: 160,
          height: 120,
          fps: 10,
          hasVideo: true,
          hasAudio: true,
        },
      ],
      audioQualities: [],
      title: 'fixture-title',
      uploader: 'Fixture',
    });
  });

  afterEach(() => {
    delete process.env.MAXFRAME_E2E;
    delete process.env.MAXFRAME_E2E_FIXTURE;
    if (originalFake === undefined) {
      delete process.env.MAXFRAME_FAKE_VIDEO_METADATA;
    } else {
      process.env.MAXFRAME_FAKE_VIDEO_METADATA = originalFake;
    }
    rmSync(root, { recursive: true, force: true });
  });

  it('asks yt-dlp for the fixture instead of the YouTube URL', async () => {
    process.env.MAXFRAME_E2E = '1';
    process.env.MAXFRAME_E2E_FIXTURE = fixturePath;
    process.env.MAXFRAME_FAKE_VIDEO_METADATA = '1';

    const result = await analyzeVideoHandler('https://youtu.be/dQw4w9WgXcQ');

    expect(analyzeVideo).toHaveBeenCalledWith(pathToFileURL(fixturePath).href);
    expect(result.title).toBe('fixture-title');
    expect(result.videoId).toBe('dQw4w9WgXcQ');
  });

  it('keeps the fake metadata gateway when the hook is off', async () => {
    process.env.MAXFRAME_FAKE_VIDEO_METADATA = '1';
    process.env.MAXFRAME_E2E_FIXTURE = fixturePath;

    const result = await analyzeVideoHandler(WATCH_URL);

    expect(analyzeVideo).not.toHaveBeenCalled();
    expect(result.title).toBe('');
    expect(result.videoId).toBe('dQw4w9WgXcQ');
  });

  it('rejects a missing fixture instead of calling yt-dlp', async () => {
    process.env.MAXFRAME_E2E = '1';
    process.env.MAXFRAME_E2E_FIXTURE = join(root, 'missing.mp4');

    await expect(analyzeVideoHandler(WATCH_URL)).rejects.toMatchObject({
      name: 'AnalyzeVideoUrlError',
      code: 'METADATA_UNAVAILABLE',
      technicalDetail: expect.stringContaining('does not exist') as string,
    });
    expect(analyzeVideo).not.toHaveBeenCalled();
  });
});
