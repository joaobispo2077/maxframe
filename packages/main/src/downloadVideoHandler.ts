import { existsSync } from 'node:fs';
import { join, parse as parsePath } from 'node:path';

import { BrowserWindow, dialog } from 'electron';

import { createVideoUrl } from '../../../src/domain/video/VideoUrl.js';
import { canonicalYoutubeWatchUrl } from '../../../src/domain/video/youtubeVideoId.js';
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

function dialogFiltersForMode(outputMode: 'mp3' | 'mp4') {
  if (outputMode === 'mp3') {
    return [
      { name: 'Audio', extensions: ['mp3'] },
      { name: 'All files', extensions: ['*'] },
    ];
  }
  return [
    { name: 'Video', extensions: ['mp4', 'mkv', 'webm'] },
    { name: 'All files', extensions: ['*'] },
  ];
}

async function promptSaveFilePath(
  suggestedFileName: string,
  outputMode: 'mp3' | 'mp4',
): Promise<string> {
  const parentWindow = BrowserWindow.getFocusedWindow();
  const dialogOptions = {
    defaultPath: suggestedFileName,
    filters: dialogFiltersForMode(outputMode),
  };
  const { canceled, filePath } = parentWindow
    ? await dialog.showSaveDialog(parentWindow, dialogOptions)
    : await dialog.showSaveDialog(dialogOptions);

  if (canceled || !filePath) {
    throw new Error('Download canceled.');
  }
  return filePath;
}

async function resolveFfmpegForDownload(
  hasAudio: boolean,
  outputMode: 'mp3' | 'mp4',
): Promise<string> {
  const ffmpegExecutable = resolveFfmpegExecutable();
  const needsProbe = ytdlpDownloadNeedsFfmpeg(hasAudio) || outputMode === 'mp3';
  if (!needsProbe) {
    return ffmpegExecutable;
  }
  const ok = await probeFfmpegAvailable(ffmpegExecutable);
  if (!ok) {
    throw new Error(ffmpegMissingMessage(ffmpegExecutable));
  }
  return ffmpegExecutable;
}

function buildRunYtdlpParams(
  params: DownloadVideoRequest,
  sink: DownloadVideoSink | undefined,
  formatSelector: string,
  outputTemplate: string,
  ffmpegExecutable: string,
) {
  return {
    executable: resolveYtdlpExecutable(),
    ffmpegExecutable,
    url: params.url,
    formatSelector,
    outputTemplate,
    ...(params.outputMode === 'mp4'
      ? { mergeOutputFormat: 'mp4' as const }
      : {}),
    ...(params.outputMode === 'mp3'
      ? { extractAudio: { format: 'mp3' as const } }
      : {}),
    timeoutMs: 0,
    onProgressLine: sink?.onProgressLine,
    signal: sink?.signal,
  };
}

export async function downloadVideoHandler(
  params: DownloadVideoRequest,
  sink?: DownloadVideoSink,
): Promise<DownloadVideoResult> {
  const validatedUrl = createVideoUrl(params.url);
  const paramsForYtdlp: DownloadVideoRequest = {
    ...params,
    url: canonicalYoutubeWatchUrl(validatedUrl),
  };

  const filePath = await promptSaveFilePath(
    params.suggestedFileName,
    params.outputMode,
  );
  const parsed = parsePath(filePath);
  const outputTemplate = join(parsed.dir, parsed.name) + '.%(ext)s';
  const formatSelector = buildYtdlpFormatSelector(
    paramsForYtdlp.formatId,
    paramsForYtdlp.hasAudio,
    paramsForYtdlp.outputMode,
  );

  const ffmpegExecutable = await resolveFfmpegForDownload(
    paramsForYtdlp.hasAudio,
    paramsForYtdlp.outputMode,
  );

  await runYtdlpDownload(
    buildRunYtdlpParams(
      paramsForYtdlp,
      sink,
      formatSelector,
      outputTemplate,
      ffmpegExecutable,
    ),
  );

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
