import type { OfficialFetch } from '@src/infrastructure/youtube/fetchOfficialHttps.js';

import { YTDLP_LATEST_RELEASE_URL } from '@src/domain/ytdlp/officialYtdlpRelease.js';
import { YtdlpUpdateFailure } from '@src/domain/ytdlp/YtdlpUpdateFailure.js';
import { YTDLP_CHECK_TIMEOUT_MS } from '@src/domain/ytdlp/ytdlpUpdatePolicy.js';
import {
  fetchLatestYtdlpRelease,
  parseLatestRelease,
} from '@src/infrastructure/youtube/fetchLatestYtdlpRelease.js';
import { fetchOfficialHttps } from '@src/infrastructure/youtube/fetchOfficialHttps.js';
import { describe, expect, it, vi } from 'vitest';

const OFFICIAL =
  'https://github.com/yt-dlp/yt-dlp/releases/download/2026.08.19/yt-dlp.exe';

function jsonResponse(status: number, body: string, location?: string) {
  const bytes = Buffer.from(body);
  return {
    status,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'location' ? (location ?? null) : null,
    },
    arrayBuffer: async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };
}

describe('fetchOfficialHttps', () => {
  it('follows https redirects and refuses anything else', async () => {
    const calls: string[] = [];
    const fetchImpl: OfficialFetch = async (url, init) => {
      calls.push(url);
      expect(init.redirect).toBe('manual');
      expect(init.headers['User-Agent']).toBe('maxframe');
      if (url === OFFICIAL) {
        return jsonResponse(302, '', 'https://cdn.example/yt-dlp.exe');
      }
      return jsonResponse(200, 'ok');
    };
    const body = await fetchOfficialHttps({
      url: OFFICIAL,
      expectUrl: OFFICIAL,
      timeoutMs: 1000,
      fetchImpl,
    });
    expect(body.toString()).toBe('ok');
    expect(calls).toEqual([OFFICIAL, 'https://cdn.example/yt-dlp.exe']);

    const insecure: OfficialFetch = async () =>
      jsonResponse(302, '', 'http://evil.example/yt-dlp.exe');
    await expect(
      fetchOfficialHttps({
        url: OFFICIAL,
        expectUrl: OFFICIAL,
        timeoutMs: 1000,
        fetchImpl: insecure,
      }),
    ).rejects.toMatchObject({ reason: 'checksum' });

    await expect(
      fetchOfficialHttps({
        url: 'https://evil.example/yt-dlp.exe',
        expectUrl: OFFICIAL,
        timeoutMs: 1000,
        fetchImpl,
      }),
    ).rejects.toMatchObject({ reason: 'checksum' });
  });

  it('treats non-2xx, empty bodies, and timeouts as network failures', async () => {
    for (const status of [403, 429, 500]) {
      const fetchImpl: OfficialFetch = async () => jsonResponse(status, 'nope');
      await expect(
        fetchOfficialHttps({
          url: OFFICIAL,
          expectUrl: OFFICIAL,
          timeoutMs: 1000,
          fetchImpl,
        }),
      ).rejects.toMatchObject({
        reason: 'network',
        message: `HTTP ${status}`,
      });
    }

    const empty: OfficialFetch = async () => jsonResponse(200, '');
    await expect(
      fetchOfficialHttps({
        url: OFFICIAL,
        expectUrl: OFFICIAL,
        timeoutMs: 1000,
        fetchImpl: empty,
      }),
    ).rejects.toMatchObject({ reason: 'network', message: 'empty download' });

    const hanging: OfficialFetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          const error = new Error('The operation was aborted due to timeout');
          error.name = 'TimeoutError';
          reject(error);
        });
      });
    await expect(
      fetchOfficialHttps({
        url: OFFICIAL,
        expectUrl: OFFICIAL,
        timeoutMs: 15,
        fetchImpl: hanging,
      }),
    ).rejects.toMatchObject({ reason: 'network' });
  });

  it('rejects a credential redirect and too many hops', async () => {
    const credential: OfficialFetch = async () =>
      jsonResponse(302, '', 'https://user:pass@cdn.example/yt-dlp.exe');
    await expect(
      fetchOfficialHttps({
        url: OFFICIAL,
        expectUrl: OFFICIAL,
        timeoutMs: 1000,
        fetchImpl: credential,
      }),
    ).rejects.toMatchObject({ reason: 'checksum' });

    const loop: OfficialFetch = async (url) => jsonResponse(302, '', url);
    await expect(
      fetchOfficialHttps({
        url: OFFICIAL,
        expectUrl: OFFICIAL,
        timeoutMs: 1000,
        fetchImpl: loop,
      }),
    ).rejects.toMatchObject({
      reason: 'network',
      message: 'too many redirects',
    });

    const missing: OfficialFetch = async () => jsonResponse(302, '', undefined);
    await expect(
      fetchOfficialHttps({
        url: OFFICIAL,
        expectUrl: OFFICIAL,
        timeoutMs: 1000,
        fetchImpl: missing,
      }),
    ).rejects.toMatchObject({ reason: 'checksum' });
  });
});

describe('fetchLatestYtdlpRelease', () => {
  it('reads the latest stable tag from the official API', async () => {
    const fetchImpl: OfficialFetch = async (url) => {
      expect(url).toBe(YTDLP_LATEST_RELEASE_URL);
      return jsonResponse(
        200,
        JSON.stringify({
          tag_name: '2026.08.19',
          published_at: '2026-08-19T00:00:00Z',
          draft: false,
          prerelease: false,
        }),
      );
    };
    await expect(
      fetchLatestYtdlpRelease({ timeoutMs: 1000, fetchImpl }),
    ).resolves.toEqual({
      version: '2026.08.19',
      publishedAt: '2026-08-19T00:00:00Z',
    });
    expect(YTDLP_CHECK_TIMEOUT_MS).toBe(10_000);
  });

  it('fails on rate limits and responses it cannot parse', async () => {
    for (const status of [403, 429]) {
      const fetchImpl: OfficialFetch = async () => jsonResponse(status, '{}');
      await expect(
        fetchLatestYtdlpRelease({ timeoutMs: 1000, fetchImpl }),
      ).rejects.toBeInstanceOf(YtdlpUpdateFailure);
    }
    expect(() => parseLatestRelease('not-json')).toThrow(/unparsable/);
    expect(() => parseLatestRelease('null')).toThrow(/unparsable/);
    expect(() =>
      parseLatestRelease(
        JSON.stringify({
          tag_name: '2026.08.19',
          draft: true,
          published_at: 'x',
        }),
      ),
    ).toThrow(/unparsable/);
    expect(() =>
      parseLatestRelease(
        JSON.stringify({
          tag_name: '2026.08.19',
          prerelease: true,
          published_at: 'x',
        }),
      ),
    ).toThrow(/unparsable/);
    expect(() =>
      parseLatestRelease(JSON.stringify({ tag_name: 'nightly' })),
    ).toThrow(/unparsable/);
    expect(() =>
      parseLatestRelease(JSON.stringify({ tag_name: '2026.08.19' })),
    ).toThrow(/unparsable/);
  });

  it('uses the default timeout when the caller omits one', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(500, 'nope')),
    );
    try {
      await expect(fetchLatestYtdlpRelease()).rejects.toMatchObject({
        message: 'HTTP 500',
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
