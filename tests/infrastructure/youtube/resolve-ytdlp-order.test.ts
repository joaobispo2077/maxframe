import { createHash } from 'node:crypto';
import { join } from 'node:path';

import { resolveYtdlp } from '@src/infrastructure/youtube/resolveYtdlpExecutable.js';
import { preferUpdated } from '@src/infrastructure/youtube/selectUpdatedYtdlp.js';
import { describe, expect, it } from 'vitest';

const UPDATED = '2026.08.19';
const BUNDLED = '2026.03.17';
const BODY = Buffer.from('stored-binary');
const HASH = createHash('sha256').update(BODY).digest('hex');

function layout(userData: string, resources: string) {
  return {
    binary: join(userData, 'yt-dlp', 'yt-dlp.exe'),
    record: join(userData, 'yt-dlp', 'record.json'),
    bundled: join(resources, 'yt-dlp', 'yt-dlp.exe'),
  };
}

function files(entries: Record<string, Buffer | string>) {
  const stored = new Map<string, Buffer>();
  for (const [path, data] of Object.entries(entries)) {
    stored.set(path, Buffer.from(data));
  }
  return {
    exists: (path: string) => stored.has(path),
    readText: (path: string) => {
      const hit = stored.get(path);
      if (!hit) {
        throw new Error(`missing ${path}`);
      }
      return hit.toString('utf8');
    },
    readFile: (path: string) => {
      const hit = stored.get(path);
      if (!hit) {
        throw new Error(`missing ${path}`);
      }
      return hit;
    },
    reads: () => 0,
  };
}

describe('resolveYtdlp order', () => {
  const userData = join('Users', 'João', 'AppData', 'Roaming', 'maxframe');
  const resources = join('resources');
  const paths = layout(userData, resources);
  const record = JSON.stringify({ version: UPDATED, sha256: HASH });

  it('prefers YT_DLP_PATH, then a verified newer copy, then the bundle, then PATH', () => {
    const store = files({
      [paths.binary]: BODY,
      [paths.record]: record,
      [paths.bundled]: 'bundle',
    });
    expect(
      resolveYtdlp({
        env: { YT_DLP_PATH: '  C:\\tools\\yt-dlp.exe  ' },
        platform: 'win32',
        userDataDir: userData,
        resourcesPath: resources,
        bundledVersion: BUNDLED,
        ...store,
      }).executable,
    ).toBe('C:\\tools\\yt-dlp.exe');

    const updated = resolveYtdlp({
      env: {},
      platform: 'win32',
      userDataDir: userData,
      resourcesPath: resources,
      bundledVersion: BUNDLED,
      ...store,
    });
    expect(updated).toMatchObject({
      executable: paths.binary,
      source: 'updated',
      version: UPDATED,
    });
    expect(updated.executable).toContain('João');
    expect(updated.executable).not.toContain('"');

    store.readFile(paths.binary);
    const again = resolveYtdlp({
      env: {},
      platform: 'win32',
      userDataDir: userData,
      resourcesPath: resources,
      bundledVersion: BUNDLED,
      ...store,
    });
    expect(again.source).toBe('updated');
  });

  it('uses the bundled copy when it is the same or newer, and when the stored copy is absent', () => {
    const store = files({
      [paths.binary]: BODY,
      [paths.record]: record,
      [paths.bundled]: 'bundle',
    });
    expect(
      resolveYtdlp({
        env: {},
        platform: 'win32',
        userDataDir: userData,
        resourcesPath: resources,
        bundledVersion: UPDATED,
        ...store,
      }),
    ).toMatchObject({ executable: paths.bundled, source: 'bundled' });
    expect(
      resolveYtdlp({
        env: {},
        platform: 'win32',
        userDataDir: userData,
        resourcesPath: resources,
        bundledVersion: '2026.09.01',
        ...store,
      }).source,
    ).toBe('bundled');

    const missingRecord = files({
      [paths.binary]: BODY,
      [paths.bundled]: 'bundle',
    });
    expect(
      resolveYtdlp({
        env: {},
        platform: 'win32',
        userDataDir: userData,
        resourcesPath: resources,
        bundledVersion: BUNDLED,
        ...missingRecord,
      }),
    ).toEqual({
      executable: paths.bundled,
      source: 'bundled',
      version: BUNDLED,
    });

    expect(
      resolveYtdlp({
        env: { YT_DLP_PATH: '   ' },
        platform: 'linux',
        userDataDir: undefined,
        resourcesPath: undefined,
      }),
    ).toEqual({ executable: 'yt-dlp', source: 'path' });
  });

  it('falls back when the stored hash does not match the record', () => {
    const tampered = files({
      [paths.binary]: Buffer.from('tampered'),
      [paths.record]: record,
      [paths.bundled]: 'bundle',
    });
    expect(
      resolveYtdlp({
        env: {},
        platform: 'win32',
        userDataDir: userData,
        resourcesPath: resources,
        bundledVersion: BUNDLED,
        ...tampered,
      }),
    ).toMatchObject({
      executable: paths.bundled,
      source: 'bundled',
      fallbackBundledVersion: BUNDLED,
    });

    const unreadable = files({
      [paths.record]: record,
      [paths.bundled]: 'bundle',
    });
    unreadable.exists = (path) =>
      path === paths.binary || path === paths.record || path === paths.bundled;
    unreadable.readFile = () => {
      throw new Error('locked');
    };
    expect(
      resolveYtdlp({
        env: {},
        platform: 'win32',
        userDataDir: userData,
        resourcesPath: resources,
        bundledVersion: BUNDLED,
        ...unreadable,
      }).fallbackBundledVersion,
    ).toBe(BUNDLED);

    const noBundle = files({
      [paths.binary]: Buffer.from('tampered'),
      [paths.record]: record,
    });
    expect(
      resolveYtdlp({
        env: {},
        platform: 'win32',
        userDataDir: userData,
        resourcesPath: undefined,
        ...noBundle,
      }),
    ).toMatchObject({
      executable: 'yt-dlp',
      source: 'path',
      fallbackBundledVersion: 'unknown',
    });
  });

  it('keeps an updated copy only when it is newer than the bundled one', () => {
    expect(preferUpdated(UPDATED, BUNDLED, true)).toBe(true);
    expect(preferUpdated(UPDATED, UPDATED, true)).toBe(false);
    expect(preferUpdated(UPDATED, undefined, false)).toBe(true);
    expect(preferUpdated(UPDATED, undefined, true)).toBe(false);
  });
});
