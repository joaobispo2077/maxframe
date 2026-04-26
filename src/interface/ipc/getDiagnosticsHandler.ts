import { existsSync } from 'node:fs';

import { app } from 'electron';

import { resolveFfmpegExecutable } from '../../infrastructure/ffmpeg/resolveFfmpegExecutable.js';
import { resolveYtdlpExecutable } from '../../infrastructure/youtube/resolveYtdlpExecutable.js';
import { getLastError } from './errorStore.js';

export type DiagnosticsReport = {
  ytdlpPath: string;
  ytdlpFound: boolean;
  ffmpegPath: string;
  ffmpegFound: boolean;
  platform: string;
  arch: string;
  appVersion: string;
  pathEnv: string;
  lastError: string | undefined;
};

function isBareExecutableName(path: string): boolean {
  return (
    path === 'yt-dlp' ||
    path === 'ffmpeg' ||
    path === 'yt-dlp.exe' ||
    path === 'ffmpeg.exe'
  );
}

export function getDiagnosticsHandler(): DiagnosticsReport {
  const ytdlpPath = resolveYtdlpExecutable();
  const ffmpegPath = resolveFfmpegExecutable();

  return {
    ytdlpPath,
    ytdlpFound: !isBareExecutableName(ytdlpPath) && existsSync(ytdlpPath),
    ffmpegPath,
    ffmpegFound: !isBareExecutableName(ffmpegPath) && existsSync(ffmpegPath),
    platform: process.platform,
    arch: process.arch,
    appVersion: app.getVersion(),
    pathEnv: (process.env.PATH ?? '').slice(0, 500),
    lastError: getLastError(),
  };
}
