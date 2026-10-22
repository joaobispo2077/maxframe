import { createHash } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Pinned stable release. Hashes come from that release's SHA2-256SUMS. */
export const YT_DLP_VERSION = '2026.08.19';
export const YT_DLP_ASSET_NAME = 'yt-dlp.exe';
export const YT_DLP_SHA256 =
  '66674953fe251b89f4d08c5f0e35e0728679bd67ab3d7d05c0562af101dd3e7a';

const OFFICIAL_RELEASE_PREFIX =
  'https://github.com/yt-dlp/yt-dlp/releases/download/';

export function officialReleaseUrl(version, assetName) {
  return `${OFFICIAL_RELEASE_PREFIX}${version}/${assetName}`;
}

export function assertOfficialReleaseUrl(url, version, assetName) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`yt-dlp URL is not valid: ${url}`);
  }
  const expected = officialReleaseUrl(version, assetName);
  if (parsed.protocol !== 'https:' || parsed.href !== expected) {
    throw new Error(`Refusing yt-dlp download from a non-official URL: ${url}`);
  }
}

/**
 * Returns the single SHA-256 line for `assetName` in a SHA2-256SUMS file.
 * Fails closed when the asset is missing or listed more than once.
 */
export function sha256ForAsset(sumsText, assetName) {
  const matches = [];
  for (const rawLine of sumsText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    const match = /^([0-9a-fA-F]{64})\s+\*?(\S+)$/.exec(line);
    if (match && match[2] === assetName) {
      matches.push(match[1].toLowerCase());
    }
  }
  if (matches.length !== 1) {
    throw new Error(
      `SHA2-256SUMS has ${matches.length} entries for ${assetName}, expected 1`,
    );
  }
  return matches[0];
}

export function assertSameSha256(actual, expected, label) {
  if (actual.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(
      `${label} SHA-256 mismatch. expected ${expected.toLowerCase()} got ${actual.toLowerCase()}`,
    );
  }
}

export function sha256OfBytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function downloadBytes(url) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(
      `Download failed with HTTP ${response.status} ${response.statusText} for ${url}`,
    );
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0) {
    throw new Error(`Download was empty for ${url}`);
  }
  return bytes;
}

export async function downloadBundledYtdlp({
  repoRoot,
  version = YT_DLP_VERSION,
  assetName = YT_DLP_ASSET_NAME,
  expectedSha256 = YT_DLP_SHA256,
  log = console.log,
} = {}) {
  if (!repoRoot) {
    throw new Error('repoRoot is required');
  }
  const assetUrl = officialReleaseUrl(version, assetName);
  const sumsUrl = officialReleaseUrl(version, 'SHA2-256SUMS');
  assertOfficialReleaseUrl(assetUrl, version, assetName);
  assertOfficialReleaseUrl(sumsUrl, version, 'SHA2-256SUMS');

  const destDir = join(repoRoot, 'buildResources', 'yt-dlp');
  const destPath = join(destDir, assetName);
  mkdirSync(destDir, { recursive: true });
  rmSync(destPath, { force: true });

  log(`yt-dlp SHA-256 check: downloading ${sumsUrl}`);
  const sumsBytes = await downloadBytes(sumsUrl);
  const sumsHash = sha256ForAsset(sumsBytes.toString('utf8'), assetName);
  log(
    `yt-dlp SHA-256 check: SHA2-256SUMS entry for ${assetName} is ${sumsHash}`,
  );
  assertSameSha256(
    sumsHash,
    expectedSha256,
    `pinned ${version} ${assetName} vs SHA2-256SUMS`,
  );
  log(
    `yt-dlp SHA-256 check: pinned SHA-256 matches SHA2-256SUMS for ${assetName}`,
  );

  log(`yt-dlp SHA-256 check: downloading ${assetUrl}`);
  const assetBytes = await downloadBytes(assetUrl);
  const fileHash = sha256OfBytes(assetBytes);
  log(`yt-dlp SHA-256 check: downloaded ${assetName} SHA-256 is ${fileHash}`);
  try {
    assertSameSha256(
      fileHash,
      expectedSha256,
      `downloaded ${version} ${assetName}`,
    );
  } catch (error) {
    rmSync(destPath, { force: true });
    throw error;
  }

  writeFileSync(destPath, assetBytes);
  log(
    `yt-dlp SHA-256 check passed for ${version} ${assetName} (${expectedSha256})`,
  );
  return destPath;
}

function isDirectRun() {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
}

if (isDirectRun()) {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
  downloadBundledYtdlp({ repoRoot }).catch((error) => {
    console.error(
      `yt-dlp SHA-256 check failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}
