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
 * Resolves ffmpeg: `FFMPEG_PATH`, then bundled `extraResources` layout, then `PATH` (`ffmpeg`).
 */
export function resolveFfmpegExecutable(): string {
  const fromEnv = process.env.FFMPEG_PATH?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  const root = resourcesPath();
  if (root) {
    const isWin = process.platform === 'win32';
    const bundledName = isWin ? 'ffmpeg.exe' : 'ffmpeg';
    const candidates = [
      join(root, 'ffmpeg', bundledName),
      join(root, bundledName),
      join(root, 'bin', bundledName),
    ];
    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return 'ffmpeg';
}
