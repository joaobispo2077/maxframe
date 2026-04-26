import { existsSync } from 'node:fs';
import { join, parse as parsePath } from 'node:path';

import { BrowserWindow, dialog } from 'electron';

import { createVideoUrl } from '../../../src/domain/video/VideoUrl.js';
import {
  ffmpegMissingMessage,
  probeFfmpegAvailable,
} from '../../../src/infrastructure/ffmpeg/probeFfmpegAvailable.js';
import { resolveFfmpegExecutable } from '../../../src/infrastructure/ffmpeg/resolveFfmpegExecutable.js';
import { buildYtdlpFormatSelector } from '../../../src/infrastructure/youtube/buildYtdlpFormatSelector.js';
import { findYtdlpOutputFile } from '../../../src/infrastructure/youtube/findYtdlpOutputFile.js';
import { resolveYtdlpExecutable } from '../../../src/infrastructure/youtube/resolveYtdlpExecutable.js';
import { runYtdlpDownload } from '../../../src/infrastructure/youtube/runYtdlpDownload.js';
import { ytdlpDownloadNeedsFfmpeg } from '../../../src/infrastructure/youtube/ytdlpDownloadNeedsFfmpeg.js';

export type DownloadVideoRequest = {
  url: string;
  formatId: string;
  hasAudio: boolean;
  /** Suggested file name without path (e.g. `Video Title - Channel.mp4`). */
  suggestedFileName: string;
  outputMode: 'mp3' | 'mp4';
};

export type DownloadVideoResult = {
  outputPath: string;
};

/** Optional hooks for Phase 5 (progress + cancel). */
export type DownloadVideoSink = {
  signal?: AbortSignal;
  onProgressLine?: (line: string) => void;
};

export async function downloadVideoHandler(
  params: DownloadVideoRequest,
  sink?: DownloadVideoSink,
): Promise<DownloadVideoResult> {
  createVideoUrl(params.url);

  const parentWindow = BrowserWindow.getFocusedWindow();
  const dialogFilters =
    params.outputMode === 'mp3'
      ? [
          { name: 'Audio', extensions: ['mp3'] },
          { name: 'All files', extensions: ['*'] },
        ]
      : [
          { name: 'Video', extensions: ['mp4', 'mkv', 'webm'] },
          { name: 'All files', extensions: ['*'] },
        ];
  const dialogOptions = {
    defaultPath: params.suggestedFileName,
    filters: dialogFilters,
  };
  const { canceled, filePath } = parentWindow
    ? await dialog.showSaveDialog(parentWindow, dialogOptions)
    : await dialog.showSaveDialog(dialogOptions);

  if (canceled || !filePath) {
    throw new Error('Download canceled.');
  }

  const parsed = parsePath(filePath);
  const outputTemplate = join(parsed.dir, parsed.name) + '.%(ext)s';
  const formatSelector = buildYtdlpFormatSelector(
    params.formatId,
    params.hasAudio,
    params.outputMode,
  );

  const ffmpegExecutable = resolveFfmpegExecutable();

  if (ytdlpDownloadNeedsFfmpeg(params.hasAudio) || params.outputMode === 'mp3') {
    const ok = await probeFfmpegAvailable(ffmpegExecutable);
    if (!ok) {
      throw new Error(ffmpegMissingMessage(ffmpegExecutable));
    }
  }

  await runYtdlpDownload({
    executable: resolveYtdlpExecutable(),
    ffmpegExecutable,
    url: params.url,
    formatSelector,
    outputTemplate,
    ...(params.outputMode === 'mp4' ? { mergeOutputFormat: 'mp4' as const } : {}),
    ...(params.outputMode === 'mp3'
      ? { extractAudio: { format: 'mp3' as const } }
      : {}),
    timeoutMs: 0,
    onProgressLine: sink?.onProgressLine,
    signal: sink?.signal,
  });

  const resolved =
    findYtdlpOutputFile(parsed.dir, parsed.name) ??
    (existsSync(filePath) ? filePath : undefined);

  if (!resolved) {
    throw new Error(
      'Download finished but no output file was found next to the path you chose. ' +
        'Check the folder for a new .mp4 or .mkv file, or inspect the yt-dlp error output above.',
    );
  }

  return { outputPath: resolved };
}

export function defaultDownloadSuggestedName(
  videoId: string | undefined,
  formatId: string,
): string {
  const id = videoId && videoId.length > 0 ? videoId : 'video';
  return `${id}-${formatId}.mp4`;
}
