import type {
  VideoAnalysis,
  VideoMetadataGateway,
} from '../../application/ports/VideoMetadataGateway.js';

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { mapYtdlpAudioFormatsToQualityOptions } from './mapYtdlpAudioFormatsToQualityOptions.js';
import { mapYtdlpFormatsToQualityOptions } from './mapYtdlpFormatsToQualityOptions.js';
import { resolveYtdlpExecutable } from './resolveYtdlpExecutable.js';
import { asString, isRecord } from './ytdlpParseHelpers.js';

const execFileAsync = promisify(execFile);
const JSON_ARGS = ['-J', '--no-warnings', '--skip-download'] as const;

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

function throwFromYtdlpExecError(error: unknown, executable: string): never {
  const code = isRecord(error) ? error.code : undefined;
  if (code === 'ENOENT') {
    throw new Error(ytdlpNotFoundMessage(executable));
  }
  const stderr = isRecord(error) ? asString(error.stderr) : undefined;
  if (typeof stderr === 'string' && stderr.trim()) {
    throw new Error(stderr.trim().slice(0, 500));
  }
  if (error instanceof Error) {
    throw new Error(error.message);
  }
  throw new Error('yt-dlp failed');
}

async function runYtdlpJsonDump(
  executable: string,
  url: string,
  timeoutMs: number,
): Promise<string> {
  try {
    const result = await execFileAsync(executable, [...JSON_ARGS, url], {
      maxBuffer: 50 * 1024 * 1024,
      timeout: timeoutMs,
      windowsHide: true,
    });
    return result.stdout;
  } catch (error: unknown) {
    throwFromYtdlpExecError(error, executable);
  }
}

function parseStdoutToVideoAnalysis(stdout: string): VideoAnalysis {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout) as unknown;
  } catch {
    throw new Error('yt-dlp returned invalid JSON.');
  }

  const title = isRecord(parsed) ? (asString(parsed.title) ?? '') : '';
  const uploader = isRecord(parsed)
    ? (asString(parsed.uploader) ??
      asString(parsed.channel) ??
      'Unknown Channel')
    : 'Unknown Channel';

  return {
    videoQualities: mapYtdlpFormatsToQualityOptions(parsed),
    audioQualities: mapYtdlpAudioFormatsToQualityOptions(parsed),
    title,
    uploader,
  };
}

export function createYtdlpVideoMetadataGateway(
  options: YtdlpGatewayOptions = {},
): VideoMetadataGateway {
  const executable = options.ytdlpExecutable ?? resolveYtdlpExecutable();
  const timeoutMs = options.timeoutMs ?? 90_000;

  return {
    async analyzeVideo(url: string): Promise<VideoAnalysis> {
      const stdout = await runYtdlpJsonDump(executable, url, timeoutMs);
      return parseStdoutToVideoAnalysis(stdout);
    },
  };
}
