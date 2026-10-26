import { join } from 'node:path';

import { videoQualitiesForYtdlpPayload } from '@src/infrastructure/youtube/fixtureGenericMp4Row';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const execFileMock = vi.fn();

vi.mock('node:child_process', () => ({
  execFile: execFileMock,
  default: { execFile: execFileMock },
}));

const FIXTURE = join(process.cwd(), 'tests/fixtures/e2e/sample.mp4');

const FIXTURE_VIDEO_ROW = {
  formatId: 'mp4',
  container: 'mp4',
  resolutionLabel: 'unknown',
  width: 0,
  height: 0,
  fps: 0,
  hasVideo: true,
  hasAudio: true,
};

function genericFilePayload(
  entry: Record<string, unknown> | null = {
    format_id: 'mp4',
    ext: 'mp4',
    vcodec: null,
  },
  extras: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    extractor: 'generic',
    formats: entry === null ? [null] : [entry],
    ...extras,
  };
}

describe('videoQualitiesForYtdlpPayload', () => {
  it('maps the active fixture generic mp4 to one video row', () => {
    const payload = genericFilePayload();
    expect(videoQualitiesForYtdlpPayload(payload, true)).toEqual([
      FIXTURE_VIDEO_ROW,
    ]);
  });

  it('maps the same row when the generic extractor omits vcodec', () => {
    const payload = genericFilePayload({ format_id: 'mp4', ext: 'mp4' });
    expect(videoQualitiesForYtdlpPayload(payload, true)).toEqual([
      FIXTURE_VIDEO_ROW,
    ]);
  });

  it('returns a new row object on each call', () => {
    const payload = genericFilePayload();
    const first = videoQualitiesForYtdlpPayload(payload, true);
    first[0]!.hasAudio = false;
    expect(videoQualitiesForYtdlpPayload(payload, true)).toEqual([
      FIXTURE_VIDEO_ROW,
    ]);
  });

  it('keeps the normal mapper when the fixture hook is off', () => {
    const payload = genericFilePayload();
    expect(videoQualitiesForYtdlpPayload(payload, false)).toEqual([]);
    const omitted = genericFilePayload({ format_id: 'mp4', ext: 'mp4' });
    expect(videoQualitiesForYtdlpPayload(omitted, false)).toEqual([]);
  });

  it('keeps a probed codec on the normal mapper even in fixture mode', () => {
    const payload = genericFilePayload({
      format_id: 'mp4',
      ext: 'mp4',
      vcodec: 'avc1',
      acodec: 'mp4a.40.2',
      width: 160,
      height: 120,
      fps: 10,
    });
    expect(videoQualitiesForYtdlpPayload(payload, true)).toEqual([
      {
        formatId: 'mp4',
        container: 'mp4',
        resolutionLabel: '120p',
        width: 160,
        height: 120,
        fps: 10,
        hasVideo: true,
        hasAudio: true,
        videoBitrateKbps: undefined,
        audioBitrateKbps: undefined,
      },
    ]);
  });

  const singleMp4 = { format_id: 'mp4', ext: 'mp4', vcodec: null };

  it.each([
    ['a non-record payload', null],
    [
      'an extractor other than generic',
      genericFilePayload(singleMp4, { extractor: 'youtube' }),
    ],
    ['a missing extractor', { formats: [singleMp4] }],
    ['formats that are not an array', { extractor: 'generic', formats: 'mp4' }],
    ['an empty format list', { extractor: 'generic', formats: [] }],
    [
      'two generic formats',
      {
        extractor: 'generic',
        formats: [
          { format_id: 'mp4', ext: 'mp4', vcodec: null },
          { format_id: 'mp4', ext: 'mp4', vcodec: null },
        ],
      },
    ],
    ['a format entry that is not a record', genericFilePayload(null)],
    ['a numeric format entry', { extractor: 'generic', formats: [1] }],
    [
      'an array-like format list',
      {
        extractor: 'generic',
        formats: {
          0: { format_id: 'mp4', ext: 'mp4', vcodec: null },
          length: 1,
        },
      },
    ],
    [
      'a format id other than mp4',
      genericFilePayload({ format_id: '18', ext: 'mp4', vcodec: null }),
    ],
    [
      'an extension other than mp4',
      genericFilePayload({ format_id: 'mp4', ext: 'mkv', vcodec: null }),
    ],
    ['a missing format id', genericFilePayload({ ext: 'mp4', vcodec: null })],
    [
      'a string vcodec of none',
      genericFilePayload({ format_id: 'mp4', ext: 'mp4', vcodec: 'none' }),
    ],
  ])('does not invent a video row for %s', (_label, payload) => {
    expect(videoQualitiesForYtdlpPayload(payload, true)).toEqual([]);
  });
});

describe('createYtdlpVideoMetadataGateway fixture generic mp4', () => {
  const stdout = JSON.stringify({
    extractor: 'generic',
    title: 'sample',
    formats: [{ format_id: 'mp4', ext: 'mp4', vcodec: null }],
  });

  beforeEach(() => {
    vi.clearAllMocks();
    execFileMock.mockImplementation((_exe, _args, _opts, callback) => {
      callback?.(null, { stdout, stderr: '' });
    });
  });

  afterEach(() => {
    delete process.env.MAXFRAME_E2E;
    delete process.env.MAXFRAME_E2E_FIXTURE;
  });

  it('drops the generic mp4 when the fixture hook is off', async () => {
    const { createYtdlpVideoMetadataGateway } = await import(
      '@src/infrastructure/youtube/YtdlpVideoMetadataGateway'
    );
    const gateway = createYtdlpVideoMetadataGateway({
      ytdlpExecutable: 'yt-dlp',
    });

    await expect(
      gateway.analyzeVideo('https://youtu.be/dQw4w9WgXcQ'),
    ).resolves.toEqual({
      title: 'sample',
      uploader: 'Unknown Channel',
      videoQualities: [],
      audioQualities: [],
    });
    expect(execFileMock.mock.calls[0]?.[1]).not.toContain('--enable-file-urls');
  });

  it('returns the mp4 video row only when the fixture hook is active', async () => {
    process.env.MAXFRAME_E2E = '1';
    process.env.MAXFRAME_E2E_FIXTURE = FIXTURE;
    const { createYtdlpVideoMetadataGateway } = await import(
      '@src/infrastructure/youtube/YtdlpVideoMetadataGateway'
    );
    const gateway = createYtdlpVideoMetadataGateway({
      ytdlpExecutable: 'yt-dlp',
    });

    await expect(
      gateway.analyzeVideo('file:///fixture/sample.mp4'),
    ).resolves.toEqual({
      title: 'sample',
      uploader: 'Unknown Channel',
      videoQualities: [FIXTURE_VIDEO_ROW],
      audioQualities: [],
    });
  });
});
