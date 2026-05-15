import { existsSync } from 'node:fs';

import { app } from 'electron';

import { resolveFfmpegExecutable } from '../../infrastructure/ffmpeg/resolveFfmpegExecutable.js';
import { probeYtdlpVersion } from '../../infrastructure/youtube/probeYtdlpVersion.js';
import { resolveYtdlpExecutable } from '../../infrastructure/youtube/resolveYtdlpExecutable.js';

import {
  getLastError,
  getLastErrorDetail,
  getLastSubmittedUrl,
} from './errorStore.js';

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
  lastErrorDetail: string | undefined;
  lastSubmittedUrl: string | undefined;
  ytdlpVersion: string | undefined;
};

function isBareExecutableName(path: string): boolean {
  return (
    path === 'yt-dlp' ||
    path === 'ffmpeg' ||
    path === 'yt-dlp.exe' ||
    path === 'ffmpeg.exe'
  );
}

export async function getDiagnosticsHandler(): Promise<DiagnosticsReport> {
  const ytdlpPath = resolveYtdlpExecutable();
  const ffmpegPath = resolveFfmpegExecutable();
  const ytdlpFound =
    !isBareExecutableName(ytdlpPath) && existsSync(ytdlpPath);
  const ytdlpVersion = ytdlpFound
    ? await probeYtdlpVersion(ytdlpPath)
    : undefined;

  return {
    ytdlpPath,
    ytdlpFound,
    ffmpegPath,
    ffmpegFound: !isBareExecutableName(ffmpegPath) && existsSync(ffmpegPath),
    platform: process.platform,
    arch: process.arch,
    appVersion: app.getVersion(),
    pathEnv: (process.env.PATH ?? '').slice(0, 500),
    lastError: getLastError(),
    lastErrorDetail: getLastErrorDetail(),
    lastSubmittedUrl: getLastSubmittedUrl(),
    ytdlpVersion,
  };
}
