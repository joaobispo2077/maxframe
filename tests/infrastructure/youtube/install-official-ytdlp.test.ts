import type { OfficialFetch } from '@src/infrastructure/youtube/fetchOfficialHttps.js';

import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  officialYtdlpAssetUrl,
  officialYtdlpSumsUrl,
} from '@src/domain/ytdlp/officialYtdlpRelease.js';
import { YtdlpUpdateFailure } from '@src/domain/ytdlp/YtdlpUpdateFailure.js';
import { installOfficialYtdlp } from '@src/infrastructure/youtube/installOfficialYtdlp.js';
import {
  createNodeYtdlpFs,
  type YtdlpFs,
} from '@src/infrastructure/youtube/ytdlpInstallFs.js';
import { describe, expect, it } from 'vitest';

const VERSION = '2026.08.19';
const BODY = Buffer.from('official-binary');
const HASH = createHash('sha256').update(BODY).digest('hex');
const SUMS_URL = officialYtdlpSumsUrl(VERSION);
const ASSET_URL = officialYtdlpAssetUrl(VERSION, 'yt-dlp.exe');

function response(status: number, body: Buffer, location?: string) {
  return {
    status,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'location' ? (location ?? null) : null,
    },
    arrayBuffer: async () =>
      body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
  };
}

function fetching(options: {
  sums?: string;
  asset?: Buffer;
  assetStatus?: number;
  assetLocation?: string;
  assetError?: Error;
}): { fetchImpl: OfficialFetch; calls: string[] } {
  const calls: string[] = [];
  const fetchImpl: OfficialFetch = async (url) => {
    calls.push(url);
    if (url === SUMS_URL) {
      return response(
        200,
        Buffer.from(options.sums ?? `${HASH}  yt-dlp.exe\n`),
      );
    }
    if (url === ASSET_URL) {
      if (options.assetError) {
        throw options.assetError;
      }
      return response(
        options.assetStatus ?? 200,
        options.asset ?? BODY,
        options.assetLocation,
      );
    }
    throw new Error(`unexpected fetch ${url}`);
  };
  return { fetchImpl, calls };
}

function memoryFs(seed: Record<string, Buffer> = {}): {
  fs: YtdlpFs;
  files: Map<string, Buffer>;
} {
  const files = new Map<string, Buffer>(Object.entries(seed));
  return {
    files,
    fs: {
      mkdir() {},
      exists: (path) => files.has(path),
      readFile(path) {
        const hit = files.get(path);
        if (!hit) {
          throw new YtdlpUpdateFailure('write', 'missing');
        }
        return hit;
      },
      writeFile(path, data) {
        files.set(path, Buffer.from(data));
      },
      rename(from, to) {
        const hit = files.get(from);
        if (!hit) {
          throw new YtdlpUpdateFailure('write', 'missing');
        }
        files.set(to, hit);
        files.delete(from);
      },
      rm(path) {
        files.delete(path);
      },
      chmod() {},
    },
  };
}

async function install(options: {
  userDataDir: string;
  fs: YtdlpFs;
  fetch: ReturnType<typeof fetching>;
  probe?: (executable: string) => Promise<string | undefined>;
  platform?: string;
}) {
  const seen: string[] = [];
  await installOfficialYtdlp({
    version: VERSION,
    userDataDir: options.userDataDir,
    platform: options.platform ?? 'win32',
    fs: options.fs,
    fetchImpl: options.fetch.fetchImpl,
    probeVersion: async (executable) => {
      seen.push(executable);
      return options.probe ? options.probe(executable) : VERSION;
    },
  });
  return seen;
}

describe('installOfficialYtdlp', () => {
  const userData = join('Users', 'João');
  const dest = join(userData, 'yt-dlp', 'yt-dlp.exe');
  const recordPath = join(userData, 'yt-dlp', 'record.json');

  it('replaces the binary only after the hash and version match', async () => {
    const store = memoryFs({ [dest]: Buffer.from('old') });
    const fetch = fetching({});
    const seen = await install({
      userDataDir: userData,
      fs: store.fs,
      fetch,
    });
    expect(store.files.get(dest)?.equals(BODY)).toBe(true);
    expect(JSON.parse(store.files.get(recordPath)!.toString())).toEqual({
      version: VERSION,
      sha256: HASH,
    });
    expect(
      [...store.files.keys()].some((path) => path.endsWith('.download')),
    ).toBe(false);
    expect([...store.files.keys()].some((path) => path.endsWith('.bak'))).toBe(
      false,
    );
    expect(seen[0]).toContain('João');
    expect(seen[0]).toBe(join(userData, 'yt-dlp', 'yt-dlp.exe.download'));
    expect(fetch.calls).toEqual([SUMS_URL, ASSET_URL]);
  });

  it('keeps the old binary when the download, hash, version, or write fails', async () => {
    const cases: Array<{
      name: string;
      sums?: string;
      asset?: Buffer;
      assetStatus?: number;
      assetLocation?: string;
      assetError?: Error;
      probe?: (executable: string) => Promise<string | undefined>;
      fs?: (store: ReturnType<typeof memoryFs>) => YtdlpFs;
    }> = [
      { name: 'interrupted', assetError: new Error('socket hang up') },
      { name: 'mismatch', asset: Buffer.from('tampered') },
      { name: 'missing sums', sums: `${HASH}  other\n` },
      {
        name: 'duplicate sums',
        sums: `${HASH}  yt-dlp.exe\n${'b'.repeat(64)}  yt-dlp.exe\n`,
      },
      { name: 'bad version', probe: async () => '2020.01.01' },
      { name: 'no version', probe: async () => undefined },
      {
        name: 'http redirect',
        assetStatus: 302,
        assetLocation: 'http://evil.example/yt-dlp.exe',
      },
    ];

    for (const item of cases) {
      const store = memoryFs({ [dest]: Buffer.from('old') });
      const fetch = fetching(item);
      await expect(
        install({
          userDataDir: userData,
          fs: item.fs ? item.fs(store) : store.fs,
          fetch,
          probe: item.probe,
        }),
      ).rejects.toBeInstanceOf(YtdlpUpdateFailure);
      expect(store.files.get(dest)?.toString()).toBe('old');
      expect(
        [...store.files.keys()].some((path) => path.endsWith('.download')),
      ).toBe(false);
    }
  });

  it('keeps the old binary when the folder cannot be written', async () => {
    const store = memoryFs({ [dest]: Buffer.from('old') });
    const fs: YtdlpFs = {
      ...store.fs,
      writeFile(path, data) {
        if (path.endsWith('.download')) {
          throw new YtdlpUpdateFailure('write', 'disk full');
        }
        store.files.set(path, Buffer.from(data));
      },
    };
    const fetch = fetching({});
    await expect(
      install({ userDataDir: userData, fs, fetch }),
    ).rejects.toMatchObject({ reason: 'write' });
    expect(store.files.get(dest)?.toString()).toBe('old');
  });

  it('restores the old binary when the record cannot be saved', async () => {
    const store = memoryFs({ [dest]: Buffer.from('old') });
    const fs: YtdlpFs = {
      ...store.fs,
      writeFile(path, data) {
        if (path.endsWith('record.json')) {
          throw new YtdlpUpdateFailure('write', 'disk full');
        }
        store.files.set(path, Buffer.from(data));
      },
    };
    await expect(
      install({ userDataDir: userData, fs, fetch: fetching({}) }),
    ).rejects.toMatchObject({ reason: 'write' });
    expect(store.files.get(dest)?.toString()).toBe('old');
    expect(store.files.has(recordPath)).toBe(false);
  });

  it('writes a real file under a non-ASCII user data directory', async () => {
    const root = mkdtempSync(join(tmpdir(), 'maxframe-ytdlp-'));
    const user = join(root, 'João');
    const seen: string[] = [];
    try {
      await installOfficialYtdlp({
        version: VERSION,
        userDataDir: user,
        platform: 'win32',
        fs: createNodeYtdlpFs(),
        fetchImpl: fetching({}).fetchImpl,
        probeVersion: async (executable) => {
          seen.push(executable);
          return VERSION;
        },
      });
      const installed = join(user, 'yt-dlp', 'yt-dlp.exe');
      expect(readFileSync(installed).equals(BODY)).toBe(true);
      expect(seen[0]).toBe(`${installed}.download`);
      expect(seen[0]?.includes('"')).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
