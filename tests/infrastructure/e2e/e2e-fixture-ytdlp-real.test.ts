import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import { resolveYtdlpExecutable } from '@src/infrastructure/youtube/resolveYtdlpExecutable.js';
import { createYtdlpVideoMetadataGateway } from '@src/infrastructure/youtube/YtdlpVideoMetadataGateway.js';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const FIXTURE = join(process.cwd(), 'tests/fixtures/e2e/sample.mp4');
const FILE_URL = pathToFileURL(FIXTURE).href;

function pinnedYtDlpVersion(): string {
  const source = readFileSync(
    join(process.cwd(), 'scripts/download-bundled-yt-dlp.mjs'),
    'utf8',
  );
  const match = /export const YT_DLP_VERSION = '(\d{4}\.\d{2}\.\d{2})'/.exec(
    source,
  );
  if (!match?.[1]) {
    throw new Error(
      'Pinned yt-dlp version is missing from scripts/download-bundled-yt-dlp.mjs',
    );
  }
  return match[1];
}

async function ytdlpVersion(executable: string): Promise<string> {
  const { stdout } = await execFileAsync(executable, ['--version'], {
    timeout: 30_000,
    windowsHide: true,
  });
  return stdout.trim();
}

/**
 * Uses the binary `resolveYtdlpExecutable()` returns.
 * When that binary is missing or is not the pinned release, installs the
 * pinned build (the same script the unit-tests job runs) and selects it
 * through `YT_DLP_PATH`, which is the first step of that resolver.
 */
async function resolvePinnedYtdlp(): Promise<string> {
  const expected = pinnedYtDlpVersion();
  const current = resolveYtdlpExecutable();
  try {
    if ((await ytdlpVersion(current)) === expected) {
      return current;
    }
  } catch {
    // Not on PATH, or not a runnable file. Install the pin below.
  }

  const { stdout } = await execFileAsync(
    process.execPath,
    ['scripts/ci/ensure-pinned-ytdlp.mjs'],
    {
      cwd: process.cwd(),
      timeout: 120_000,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    },
  );
  const installed = stdout.trim().split(/\r?\n/).at(-1);
  if (!installed) {
    throw new Error('Pinned yt-dlp setup did not print a path.');
  }
  process.env.YT_DLP_PATH = installed;
  const resolved = resolveYtdlpExecutable();
  const version = await ytdlpVersion(resolved);
  if (version !== expected) {
    throw new Error(
      `Resolved yt-dlp ${resolved} reported ${version}, expected pinned ${expected}.`,
    );
  }
  return resolved;
}

describe('real yt-dlp fixture file URL', () => {
  let executable = '';

  beforeAll(async () => {
    executable = await resolvePinnedYtdlp();
  }, 120_000);

  afterEach(() => {
    delete process.env.MAXFRAME_E2E;
    delete process.env.MAXFRAME_E2E_FIXTURE;
  });

  it('runs the resolved binary with -J --enable-file-urls on the sample', async () => {
    expect(resolveYtdlpExecutable()).toBe(executable);
    expect(await ytdlpVersion(executable)).toBe(pinnedYtDlpVersion());
    expect(FILE_URL.startsWith('file:///')).toBe(true);

    const { stdout } = await execFileAsync(
      executable,
      ['-J', '--enable-file-urls', FILE_URL],
      { timeout: 30_000, maxBuffer: 20 * 1024 * 1024, windowsHide: true },
    );
    const payload = JSON.parse(stdout) as {
      extractor?: string;
      title?: string;
      formats?: { format_id?: string; ext?: string; vcodec?: string | null }[];
    };
    expect(payload.extractor).toBe('generic');
    expect(payload.title).toBe('sample');
    expect(payload.formats).toEqual([
      expect.objectContaining({
        format_id: 'mp4',
        ext: 'mp4',
        vcodec: null,
      }),
    ]);
  }, 60_000);

  it('rejects a bare path and a file URL when --enable-file-urls is absent', async () => {
    await expect(
      execFileAsync(executable, ['-J', FIXTURE], {
        timeout: 30_000,
        windowsHide: true,
      }),
    ).rejects.toThrow(/not a valid URL/);

    await expect(
      execFileAsync(executable, ['-J', FILE_URL], {
        timeout: 30_000,
        windowsHide: true,
      }),
    ).rejects.toThrow(/--enable-file-urls/);
  }, 60_000);

  it('analyze uses that binary and maps the fixture to no quality rows', async () => {
    process.env.MAXFRAME_E2E = '1';
    process.env.MAXFRAME_E2E_FIXTURE = FIXTURE;
    const gateway = createYtdlpVideoMetadataGateway();

    await expect(gateway.analyzeVideo(FILE_URL)).resolves.toEqual({
      title: 'sample',
      uploader: 'Unknown Channel',
      videoQualities: [],
      audioQualities: [],
    });
  }, 60_000);
});
