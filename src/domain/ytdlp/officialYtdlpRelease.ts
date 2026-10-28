import { parseYtdlpVersion } from './compareYtdlpVersions.js';

export const YTDLP_LATEST_RELEASE_URL =
  'https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest';

const RELEASE_PREFIX = 'https://github.com/yt-dlp/yt-dlp/releases/download/';
const ASSET_NAME = /^[A-Za-z0-9._-]+$/;

export function ytdlpReleaseAssetName(platform: string): string {
  if (platform === 'win32') {
    return 'yt-dlp.exe';
  }
  if (platform === 'darwin') {
    return 'yt-dlp_macos';
  }
  if (platform === 'linux') {
    return 'yt-dlp_linux';
  }
  return 'yt-dlp';
}

export function ytdlpInstalledFileName(platform: string): string {
  if (platform === 'win32') {
    return 'yt-dlp.exe';
  }
  return 'yt-dlp';
}

export function officialYtdlpAssetUrl(
  version: string,
  assetName: string,
): string {
  if (!parseYtdlpVersion(version)) {
    throw new Error('yt-dlp version is not a stable release version');
  }
  if (!ASSET_NAME.test(assetName)) {
    throw new Error('yt-dlp asset name is not allowed');
  }
  return `${RELEASE_PREFIX}${version}/${assetName}`;
}

export function officialYtdlpSumsUrl(version: string): string {
  return officialYtdlpAssetUrl(version, 'SHA2-256SUMS');
}
