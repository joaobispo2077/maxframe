import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  YT_DLP_ASSET_NAME,
  YT_DLP_SHA256,
  YT_DLP_VERSION,
  assertOfficialReleaseUrl,
  assertSameSha256,
  downloadBytes,
  officialReleaseUrl,
  sha256ForAsset,
  sha256OfBytes,
} from '../download-bundled-yt-dlp.mjs';

/**
 * Official release asset for this host.
 * The pin in download-bundled-yt-dlp.mjs is the Windows exe. Linux CI uses
 * the same release's yt-dlp_linux build after SHA2-256SUMS matches that pin.
 */
function pinnedYtdlpAssetName(
  platform = process.platform,
  arch = process.arch,
) {
  if (platform === 'linux' && arch === 'x64') {
    return 'yt-dlp_linux';
  }
  if (platform === 'win32' && arch === 'x64') {
    return YT_DLP_ASSET_NAME;
  }
  throw new Error(
    `No pinned yt-dlp asset for ${platform} ${arch}. The repo pins ${YT_DLP_VERSION} ${YT_DLP_ASSET_NAME}.`,
  );
}

function installedBinaryName(platform = process.platform) {
  return platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
}

async function pinnedSumsText() {
  const sumsUrl = officialReleaseUrl(YT_DLP_VERSION, 'SHA2-256SUMS');
  assertOfficialReleaseUrl(sumsUrl, YT_DLP_VERSION, 'SHA2-256SUMS');
  const text = (await downloadBytes(sumsUrl)).toString('utf8');
  assertSameSha256(
    sha256ForAsset(text, YT_DLP_ASSET_NAME),
    YT_DLP_SHA256,
    `SHA2-256SUMS for ${YT_DLP_VERSION} ${YT_DLP_ASSET_NAME}`,
  );
  return text;
}

/**
 * Downloads the pinned yt-dlp release for this OS into buildResources/yt-dlp
 * and returns the executable path. Reuses a file that already matches
 * SHA2-256SUMS. The caller should point YT_DLP_PATH at the returned path.
 */
async function ensurePinnedYtdlp(repoRoot) {
  if (!repoRoot) {
    throw new Error('repoRoot is required');
  }
  const assetName = pinnedYtdlpAssetName();
  const expected = sha256ForAsset(await pinnedSumsText(), assetName);
  const destDir = join(repoRoot, 'buildResources', 'yt-dlp');
  const destPath = join(destDir, installedBinaryName());
  mkdirSync(destDir, { recursive: true });

  if (existsSync(destPath)) {
    const current = sha256OfBytes(readFileSync(destPath));
    if (current === expected) {
      chmodSync(destPath, 0o755);
      return destPath;
    }
  }

  const assetUrl = officialReleaseUrl(YT_DLP_VERSION, assetName);
  assertOfficialReleaseUrl(assetUrl, YT_DLP_VERSION, assetName);
  console.error(`Downloading pinned yt-dlp ${YT_DLP_VERSION} ${assetName}`);
  const bytes = await downloadBytes(assetUrl);
  assertSameSha256(
    sha256OfBytes(bytes),
    expected,
    `downloaded ${YT_DLP_VERSION} ${assetName}`,
  );
  const partial = `${destPath}.download`;
  try {
    writeFileSync(partial, bytes);
    chmodSync(partial, 0o755);
    renameSync(partial, destPath);
  } catch (error) {
    rmSync(partial, { force: true });
    throw error;
  }
  console.error(`Pinned yt-dlp ${YT_DLP_VERSION} ready at ${destPath}`);
  return destPath;
}

function isDirectRun() {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
}

if (isDirectRun()) {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  ensurePinnedYtdlp(repoRoot)
    .then((destPath) => {
      process.stdout.write(`${destPath}\n`);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
