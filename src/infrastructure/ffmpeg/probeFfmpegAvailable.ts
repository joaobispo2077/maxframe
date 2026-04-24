import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function ffmpegMissingMessage(executable: string): string {
  return (
    `Could not run "${executable}". Merging video+audio needs ffmpeg on your PATH, ` +
    `or set FFMPEG_PATH to the ffmpeg binary. See https://ffmpeg.org/download.html .`
  );
}

/**
 * Returns whether `ffmpeg -version` runs successfully (merge/remux path).
 * @param execImpl — injectable for tests (defaults to `execFile`).
 */
export async function probeFfmpegAvailable(
  executable: string,
  execImpl: typeof execFile = execFile,
): Promise<boolean> {
  const execFileAsync = promisify(execImpl);
  try {
    await execFileAsync(executable, ['-hide_banner', '-version'], {
      maxBuffer: 512 * 1024,
      timeout: 8000,
      windowsHide: true,
    });
    return true;
  } catch (error: unknown) {
    const code = isRecord(error) ? error.code : undefined;
    if (code === 'ENOENT') {
      return false;
    }
    return false;
  }
}
