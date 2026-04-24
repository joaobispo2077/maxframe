import { existsSync } from 'node:fs';
import { join } from 'node:path';

type ProcessWithResources = NodeJS.Process & {
  resourcesPath?: string;
};

function resourcesPath(): string | undefined {
  const p = process as ProcessWithResources;
  return typeof p.resourcesPath === 'string' && p.resourcesPath.length > 0
    ? p.resourcesPath
    : undefined;
}

/**
 * Resolves the yt-dlp binary: `YT_DLP_PATH`, then bundled `extraResources` layout, then `PATH` lookup via `yt-dlp`.
 */
export function resolveYtdlpExecutable(): string {
  const fromEnv = process.env.YT_DLP_PATH?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  const root = resourcesPath();
  if (root) {
    const isWin = process.platform === 'win32';
    const bundledName = isWin ? 'yt-dlp.exe' : 'yt-dlp';
    const candidates = isWin
      ? [
          join(root, 'yt-dlp', bundledName),
          join(root, bundledName),
          join(root, 'bin', bundledName),
        ]
      : [
          join(root, 'yt-dlp', bundledName),
          join(root, bundledName),
          join(root, 'bin', bundledName),
        ];
    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return 'yt-dlp';
}
