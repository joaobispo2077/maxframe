import { spawn } from 'node:child_process';
import { dirname } from 'node:path';

import {
  createYtdlpStreamLineState,
  feedYtdlpStreamLines,
  flushYtdlpStreamLines,
} from './feedYtdlpStreamLines.js';
import { socialCompatibleMp4YtdlpArgPairs } from './socialCompatibleMp4Policy.js';

function prependYtdlpArgPairs(
  args: string[],
  pairs: readonly (readonly [string, string])[],
): void {
  for (let index = pairs.length - 1; index >= 0; index -= 1) {
    const [flag, value] = pairs[index]!;
    args.unshift(flag, value);
  }
}

export type YtdlpDownloadParams = {
  executable: string;
  url: string;
  /** yt-dlp `-f` argument (e.g. `137` or `137+bestaudio/best`). */
  formatSelector: string;
  /** Output path template, e.g. `C:\\Videos\\name.%(ext)s`. */
  outputTemplate: string;
  mergeOutputFormat?: 'mp4' | 'mkv' | 'webm';
  extractAudio?: { format: 'mp3' };
  /**
   * Absolute path to the ffmpeg binary to pass via `--ffmpeg-location`.
   * Ignored when the value is a bare name (`ffmpeg` / `ffmpeg.exe`), which
   * indicates the binary was not found in bundled resources and yt-dlp should
   * search PATH on its own.
   */
  ffmpegExecutable?: string;
  /** `0` = no timeout (Node semantics). */
  timeoutMs?: number;
  /** Called for each non-empty line of stderr/stdout (yt-dlp progress). */
  onProgressLine?: (line: string) => void;
  /** When aborted, the child process is terminated and the promise rejects. */
  signal?: AbortSignal;
};

/**
 * Returns true when the value is a bare executable name (no directory component),
 * meaning the binary was not found in bundled resources and PATH will be used.
 * In that case we must NOT pass --ffmpeg-location so yt-dlp searches PATH itself.
 */
function isBareExecutableName(name: string): boolean {
  return name === 'ffmpeg' || name === 'ffmpeg.exe';
}

function ytdlpNotFoundMessage(executable: string): string {
  return (
    `Could not run "${executable}". Install yt-dlp and ensure it is on your PATH, ` +
    `or set YT_DLP_PATH to the yt-dlp binary. See https://github.com/yt-dlp/yt-dlp .`
  );
}

function attachLineStream(
  stream: NodeJS.ReadableStream,
  onLine: (line: string) => void,
  onRaw: (chunk: string) => void,
): void {
  stream.setEncoding('utf8');
  const state = createYtdlpStreamLineState();
  stream.on('data', (chunk: string) => {
    onRaw(chunk);
    feedYtdlpStreamLines(state, chunk, onLine);
  });
  stream.on('end', () => {
    flushYtdlpStreamLines(state, onLine);
  });
}

/**
 * Runs yt-dlp with streaming stderr/stdout so callers can show progress and support cancel.
 */
export async function runYtdlpDownload(
  params: YtdlpDownloadParams,
): Promise<void> {
  const args: string[] = [
    '--no-warnings',
    '--no-playlist',
    // Piped stdout is not a TTY; newline-terminated progress is easier to parse.
    '--newline',
    '-f',
    params.formatSelector,
    '-o',
    params.outputTemplate,
  ];
  if (params.mergeOutputFormat === 'mp4') {
    prependYtdlpArgPairs(args, socialCompatibleMp4YtdlpArgPairs());
  } else if (params.mergeOutputFormat) {
    args.unshift('--merge-output-format', params.mergeOutputFormat);
  }
  if (params.extractAudio) {
    args.unshift(
      '--extract-audio',
      '--audio-format',
      params.extractAudio.format,
    );
  }
  if (
    params.ffmpegExecutable &&
    !isBareExecutableName(params.ffmpegExecutable)
  ) {
    args.unshift('--ffmpeg-location', params.ffmpegExecutable);
  }
  args.push(params.url);

  const logTail: string[] = [];
  const pushTail = (s: string) => {
    logTail.push(s);
    if (logTail.length > 80) {
      logTail.splice(0, logTail.length - 80);
    }
  };

  const emit = (line: string) => {
    params.onProgressLine?.(line);
  };

  return new Promise((resolve, reject) => {
    const child = spawn(params.executable, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: dirname(params.outputTemplate),
    });

    const onAbort = () => {
      child.kill();
    };
    const signal = params.signal;
    if (signal) {
      if (signal.aborted) {
        onAbort();
      } else {
        signal.addEventListener('abort', onAbort, { once: true });
      }
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if (params.timeoutMs && params.timeoutMs > 0) {
      timeoutId = setTimeout(() => child.kill(), params.timeoutMs);
    }

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      signal?.removeEventListener('abort', onAbort);
    };

    if (child.stdout) {
      attachLineStream(child.stdout, emit, pushTail);
    }
    if (child.stderr) {
      attachLineStream(child.stderr, emit, pushTail);
    }

    child.on('error', (error: NodeJS.ErrnoException) => {
      cleanup();
      if (error.code === 'ENOENT') {
        reject(new Error(ytdlpNotFoundMessage(params.executable)));
        return;
      }
      reject(error);
    });

    child.on('close', (code) => {
      cleanup();
      if (signal?.aborted) {
        reject(new Error('Download canceled.'));
        return;
      }
      if (code === 0) {
        resolve();
        return;
      }
      const joined = logTail.join('').trim();
      const message =
        joined.length > 0
          ? joined.slice(-800)
          : `yt-dlp download failed (exit code ${code ?? 'unknown'})`;
      reject(new Error(message));
    });
  });
}
