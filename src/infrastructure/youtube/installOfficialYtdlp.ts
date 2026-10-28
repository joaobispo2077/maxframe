import { createHash } from 'node:crypto';
import { join } from 'node:path';

import {
  officialYtdlpAssetUrl,
  officialYtdlpSumsUrl,
  ytdlpInstalledFileName,
  ytdlpReleaseAssetName,
} from '../../domain/ytdlp/officialYtdlpRelease.js';
import {
  sha256Equals,
  sha256ForAsset,
} from '../../domain/ytdlp/sha256SumsLine.js';
import { YtdlpUpdateFailure } from '../../domain/ytdlp/YtdlpUpdateFailure.js';
import { YTDLP_CHECK_TIMEOUT_MS } from '../../domain/ytdlp/ytdlpUpdatePolicy.js';

import {
  fetchOfficialHttps,
  type OfficialFetch,
} from './fetchOfficialHttps.js';
import { type YtdlpFs } from './ytdlpInstallFs.js';

export async function installOfficialYtdlp(options: {
  version: string;
  userDataDir: string;
  platform: string;
  timeoutMs?: number;
  fetchImpl?: OfficialFetch;
  fs: YtdlpFs;
  probeVersion: (executable: string) => Promise<string | undefined>;
}): Promise<void> {
  const asset = ytdlpReleaseAssetName(options.platform);
  const installed = ytdlpInstalledFileName(options.platform);
  const dir = join(options.userDataDir, 'yt-dlp');
  const dest = join(dir, installed);
  const temp = join(dir, `${installed}.download`);
  const backup = join(dir, `${installed}.bak`);
  const recordPath = join(dir, 'record.json');
  const timeoutMs = options.timeoutMs ?? YTDLP_CHECK_TIMEOUT_MS;

  options.fs.mkdir(dir);
  const expected = await downloadExpectedHash({
    version: options.version,
    asset,
    timeoutMs,
    fetchImpl: options.fetchImpl,
  });
  await downloadTemp({
    version: options.version,
    asset,
    temp,
    timeoutMs,
    fetchImpl: options.fetchImpl,
    fs: options.fs,
  });
  assertTempHash(options.fs, temp, expected);
  await assertTempVersion(
    options.probeVersion,
    temp,
    options.version,
    options.fs,
  );
  commitVerifiedBinary({
    fs: options.fs,
    temp,
    dest,
    backup,
    recordPath,
    recordJson: JSON.stringify({
      version: options.version,
      sha256: expected,
    }),
  });
}

async function downloadExpectedHash(options: {
  version: string;
  asset: string;
  timeoutMs: number;
  fetchImpl?: OfficialFetch;
}): Promise<string> {
  const url = officialYtdlpSumsUrl(options.version);
  const bytes = await fetchOfficialHttps({
    url,
    expectUrl: url,
    timeoutMs: options.timeoutMs,
    fetchImpl: options.fetchImpl,
  });
  const expected = sha256ForAsset(bytes.toString('utf8'), options.asset);
  if (!expected) {
    throw new YtdlpUpdateFailure(
      'checksum',
      'SHA2-256SUMS entry missing or duplicate',
    );
  }
  return expected;
}

async function downloadTemp(options: {
  version: string;
  asset: string;
  temp: string;
  timeoutMs: number;
  fetchImpl?: OfficialFetch;
  fs: YtdlpFs;
}): Promise<void> {
  const url = officialYtdlpAssetUrl(options.version, options.asset);
  try {
    const bytes = await fetchOfficialHttps({
      url,
      expectUrl: url,
      timeoutMs: options.timeoutMs,
      fetchImpl: options.fetchImpl,
    });
    options.fs.writeFile(options.temp, bytes);
    options.fs.chmod(options.temp, 0o755);
  } catch (error) {
    options.fs.rm(options.temp);
    throw error;
  }
}

function assertTempHash(fs: YtdlpFs, temp: string, expected: string): void {
  let actual: string;
  try {
    actual = createHash('sha256').update(fs.readFile(temp)).digest('hex');
  } catch (error) {
    fs.rm(temp);
    throw error;
  }
  if (!sha256Equals(actual, expected)) {
    fs.rm(temp);
    throw new YtdlpUpdateFailure('checksum', 'SHA-256 mismatch');
  }
}

async function assertTempVersion(
  probeVersion: (executable: string) => Promise<string | undefined>,
  temp: string,
  version: string,
  fs: YtdlpFs,
): Promise<void> {
  const probed = await probeVersion(temp);
  if (probed !== version) {
    fs.rm(temp);
    throw new YtdlpUpdateFailure('checksum', 'version probe mismatch');
  }
}

function commitVerifiedBinary(options: {
  fs: YtdlpFs;
  temp: string;
  dest: string;
  backup: string;
  recordPath: string;
  recordJson: string;
}): void {
  const hadDest = options.fs.exists(options.dest);
  if (hadDest) {
    options.fs.rm(options.backup);
    options.fs.rename(options.dest, options.backup);
  }
  try {
    options.fs.rename(options.temp, options.dest);
    options.fs.writeFile(options.recordPath, options.recordJson);
  } catch (error) {
    restorePrevious(options.fs, options.dest, options.backup, hadDest);
    options.fs.rm(options.temp);
    throw error;
  }
  options.fs.rm(options.backup);
}

function restorePrevious(
  fs: YtdlpFs,
  dest: string,
  backup: string,
  hadDest: boolean,
): void {
  fs.rm(dest);
  if (hadDest && fs.exists(backup)) {
    fs.rename(backup, dest);
  }
}
