import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const VERSION_TIMEOUT_MS = 3_000;
const MAX_VERSION_LENGTH = 120;

function isBareExecutableName(path: string): boolean {
  return path === 'yt-dlp' || path === 'yt-dlp.exe';
}

/**
 * Runs `yt-dlp --version` when the resolved path is a real file path.
 * Returns undefined on failure, timeout, or bare executable name.
 */
export async function probeYtdlpVersion(
  executablePath: string,
): Promise<string | undefined> {
  if (isBareExecutableName(executablePath)) {
    return undefined;
  }

  try {
    const result = await execFileAsync(executablePath, ['--version'], {
      timeout: VERSION_TIMEOUT_MS,
      windowsHide: true,
    });
    const stdout =
      typeof result.stdout === 'string' ? result.stdout.trim() : '';
    if (!stdout) {
      return undefined;
    }
    return stdout.slice(0, MAX_VERSION_LENGTH);
  } catch {
    return undefined;
  }
}
