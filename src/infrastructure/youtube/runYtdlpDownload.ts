import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type YtdlpDownloadParams = {
  executable: string;
  url: string;
  /** yt-dlp `-f` argument (e.g. `137` or `137+bestaudio/best`). */
  formatSelector: string;
  /** Output path template, e.g. `C:\\Videos\\name.%(ext)s`. */
  outputTemplate: string;
  mergeOutputFormat?: 'mp4' | 'mkv' | 'webm';
  /** `0` = no timeout (Node semantics for `execFile`). */
  timeoutMs?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  return undefined;
}

function ytdlpNotFoundMessage(executable: string): string {
  return (
    `Could not run "${executable}". Install yt-dlp and ensure it is on your PATH, ` +
    `or set YT_DLP_PATH to the yt-dlp binary. See https://github.com/yt-dlp/yt-dlp .`
  );
}

export async function runYtdlpDownload(
  params: YtdlpDownloadParams,
): Promise<void> {
  const args: string[] = [
    '--no-warnings',
    '--no-playlist',
    '-f',
    params.formatSelector,
    '-o',
    params.outputTemplate,
  ];
  if (params.mergeOutputFormat) {
    args.unshift('--merge-output-format', params.mergeOutputFormat);
  }
  args.push(params.url);

  try {
    await execFileAsync(params.executable, args, {
      maxBuffer: 10 * 1024 * 1024,
      timeout: params.timeoutMs ?? 0,
      windowsHide: true,
    });
  } catch (error: unknown) {
    const code = isRecord(error) ? error.code : undefined;
    if (code === 'ENOENT') {
      throw new Error(ytdlpNotFoundMessage(params.executable));
    }
    const stderr = isRecord(error) ? asString(error.stderr) : undefined;
    let message = 'yt-dlp download failed';
    if (typeof stderr === 'string' && stderr.trim()) {
      message = stderr.trim().slice(0, 800);
    } else if (error instanceof Error) {
      message = error.message;
    }
    throw new Error(message);
  }
}
