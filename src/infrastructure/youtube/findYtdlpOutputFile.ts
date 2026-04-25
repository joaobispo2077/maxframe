import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIRECT_EXTENSIONS = ['.mp4', '.mkv', '.webm', '.m4a', '.opus'] as const;

const SKIP_SUFFIXES = ['.part', '.tmp', '.temp', '.ytdl', '.download'];

function shouldSkipFileName(fileName: string): boolean {
  return SKIP_SUFFIXES.some((s) => fileName.endsWith(s));
}

/**
 * Finds the media file yt-dlp wrote for template `baseName.%(ext)s` in `outputDir`.
 */
export function findYtdlpOutputFile(
  outputDir: string,
  baseName: string,
): string | undefined {
  for (const ext of DIRECT_EXTENSIONS) {
    const p = join(outputDir, baseName + ext);
    if (existsSync(p)) {
      return p;
    }
  }

  let entries: string[];
  try {
    entries = readdirSync(outputDir);
  } catch {
    return undefined;
  }

  const prefix = `${baseName}.`;
  const candidates = entries.filter(
    (name) => name.startsWith(prefix) && !shouldSkipFileName(name),
  );

  const scored = candidates
    .map((name) => {
      const lower = name.toLowerCase();
      const ext = DIRECT_EXTENSIONS.find((e) => lower.endsWith(e));
      const score = ext
        ? DIRECT_EXTENSIONS.indexOf(ext)
        : DIRECT_EXTENSIONS.length;
      return { name, score };
    })
    .sort((a, b) => a.score - b.score);

  for (const { name } of scored) {
    const full = join(outputDir, name);
    if (existsSync(full)) {
      return full;
    }
  }

  return undefined;
}
