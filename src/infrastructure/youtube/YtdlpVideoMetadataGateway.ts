import type { VideoMetadataGateway } from '../../application/ports/VideoMetadataGateway.js';

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { mapYtdlpFormatsToQualityOptions } from './mapYtdlpFormatsToQualityOptions.js';
import { resolveYtdlpExecutable } from './resolveYtdlpExecutable.js';

const execFileAsync = promisify(execFile);
const JSON_ARGS = ['-J', '--no-warnings', '--skip-download'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  return undefined;
}

export type YtdlpGatewayOptions = {
  /** Executable name or path (default `yt-dlp`, resolved via `PATH`). */
  ytdlpExecutable?: string;
  /** Max time for yt-dlp to finish (ms). */
  timeoutMs?: number;
};

function ytdlpNotFoundMessage(executable: string): string {
  return (
    `Could not run "${executable}". Install yt-dlp and ensure it is on your PATH, ` +
    `or set YT_DLP_PATH to the yt-dlp binary. See https://github.com/yt-dlp/yt-dlp .`
  );
}

export function createYtdlpVideoMetadataGateway(
  options: YtdlpGatewayOptions = {},
): VideoMetadataGateway {
  const executable = options.ytdlpExecutable ?? resolveYtdlpExecutable();
  const timeoutMs = options.timeoutMs ?? 90_000;

  return {
    async analyzeVideo(url: string) {
      let stdout: string;
      try {
        const result = await execFileAsync(executable, [...JSON_ARGS, url], {
          maxBuffer: 50 * 1024 * 1024,
          timeout: timeoutMs,
          windowsHide: true,
        });
        stdout = result.stdout;
      } catch (error: unknown) {
        const code = isRecord(error) ? error.code : undefined;
        if (code === 'ENOENT') {
          throw new Error(ytdlpNotFoundMessage(executable));
        }
        const stderr = isRecord(error) ? asString(error.stderr) : undefined;
        let message = 'yt-dlp failed';
        if (typeof stderr === 'string' && stderr.trim()) {
          message = stderr.trim().slice(0, 500);
        } else if (error instanceof Error) {
          message = error.message;
        }
        throw new Error(message);
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(stdout) as unknown;
      } catch {
        throw new Error('yt-dlp returned invalid JSON.');
      }

      return mapYtdlpFormatsToQualityOptions(parsed);
    },
  };
}
