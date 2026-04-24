import { existsSync } from 'node:fs';
import { join, parse as parsePath } from 'node:path';

import { BrowserWindow, dialog } from 'electron';

import { createVideoUrl } from '../../../src/domain/video/VideoUrl.js';
import { buildYtdlpFormatSelector } from '../../../src/infrastructure/youtube/buildYtdlpFormatSelector.js';
import { resolveYtdlpExecutable } from '../../../src/infrastructure/youtube/resolveYtdlpExecutable.js';
import { runYtdlpDownload } from '../../../src/infrastructure/youtube/runYtdlpDownload.js';

export type DownloadVideoRequest = {
  url: string;
  formatId: string;
  hasAudio: boolean;
  /** Suggested file name without path (e.g. `dQw4w9WgXcQ-137.mp4`). */
  suggestedFileName: string;
};

export type DownloadVideoResult = {
  outputPath: string;
};

function guessOutputPath(outputTemplateBase: string): string | undefined {
  for (const ext of ['.mp4', '.mkv', '.webm', '.m4a', '.opus']) {
    const p = outputTemplateBase + ext;
    if (existsSync(p)) {
      return p;
    }
  }
  return undefined;
}

export async function downloadVideoHandler(
  params: DownloadVideoRequest,
): Promise<DownloadVideoResult> {
  createVideoUrl(params.url);

  const parentWindow = BrowserWindow.getFocusedWindow();
  const dialogOptions = {
    defaultPath: params.suggestedFileName,
    filters: [
      { name: 'Video', extensions: ['mp4', 'mkv', 'webm', 'm4a'] },
      { name: 'All files', extensions: ['*'] },
    ],
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
  );

  await runYtdlpDownload({
    executable: resolveYtdlpExecutable(),
    url: params.url,
    formatSelector,
    outputTemplate,
    mergeOutputFormat: 'mp4',
    timeoutMs: 0,
  });

  const base = join(parsed.dir, parsed.name);
  const resolved = guessOutputPath(base) ?? filePath;

  return { outputPath: resolved };
}

export function defaultDownloadSuggestedName(
  videoId: string | undefined,
  formatId: string,
): string {
  const id = videoId && videoId.length > 0 ? videoId : 'video';
  return `${id}-${formatId}.mp4`;
}
