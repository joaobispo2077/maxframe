import type { IpcRendererEvent } from 'electron';

import { ipcRenderer } from 'electron';

export type TitleBarInset = {
  height: number;
  padLeft: number;
  padRight: number;
};

export type InitialAppState = {
  appName: string;
  status: 'ready';
  isPortable: boolean;
  titleBarInset: TitleBarInset;
};

export type QualityOption = {
  formatId: string;
  container: string;
  resolutionLabel: string;
  width: number;
  height: number;
  fps: number;
  hasVideo: boolean;
  hasAudio: boolean;
  videoBitrateKbps?: number;
  audioBitrateKbps?: number;
};

export type AnalyzeVideoUrlResult = {
  url: string;
  videoId: string | undefined;
  title: string;
  uploader: string;
  qualities: QualityOption[];
  bestQuality?: QualityOption;
  audioQualities: QualityOption[];
  bestAudioQuality?: QualityOption;
};

export type DownloadVideoRequest = {
  url: string;
  formatId: string;
  hasAudio: boolean;
  suggestedFileName: string;
  outputMode: 'mp3' | 'mp4';
  outputDir?: string;
};

export type PickOutputFolderResult =
  | { canceled: true }
  | { canceled: false; folderPath: string };

export type DownloadVideoResult = {
  outputPath: string;
};

export async function getInitialAppState(): Promise<InitialAppState> {
  return ipcRenderer.invoke('app:get-initial-state');
}

export async function ping(payload: string): Promise<string> {
  return ipcRenderer.invoke('app:ping', payload);
}

export async function analyzeVideoUrl(
  url: string,
): Promise<AnalyzeVideoUrlResult> {
  return ipcRenderer.invoke('app:analyze-video-url', url);
}

const CHANNEL_DOWNLOAD_PROGRESS = 'app:download-video-progress';
const CHANNEL_DOWNLOAD_CANCEL = 'app:download-video-cancel';

export async function downloadVideo(
  request: DownloadVideoRequest,
): Promise<DownloadVideoResult> {
  return ipcRenderer.invoke('app:download-video', request);
}

/** Subscribe to yt-dlp progress lines during an active `downloadVideo` call. */
export function subscribeDownloadProgress(
  listener: (payload: { line: string }) => void,
): () => void {
  const handler = (_event: IpcRendererEvent, payload: { line: string }) => {
    listener(payload);
  };
  ipcRenderer.on(CHANNEL_DOWNLOAD_PROGRESS, handler);
  return () => {
    ipcRenderer.removeListener(CHANNEL_DOWNLOAD_PROGRESS, handler);
  };
}

/** Request cancellation of the in-flight download (main process aborts yt-dlp). */
export async function cancelDownload(): Promise<{ canceled: boolean }> {
  return ipcRenderer.invoke(CHANNEL_DOWNLOAD_CANCEL);
}

/** Pick a folder for batch queue downloads (skips per-file save dialogs). */
export async function pickOutputFolder(): Promise<PickOutputFolderResult> {
  return ipcRenderer.invoke('app:pick-output-folder');
}

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

/** Sync the debug mode toggle state to the main process. */
export async function setDebugMode(on: boolean): Promise<void> {
  return ipcRenderer.invoke('app:set-debug-mode', { on });
}

/** Collect diagnostic information from the main process. */
export async function getDiagnostics(): Promise<DiagnosticsReport> {
  return ipcRenderer.invoke('app:get-diagnostics');
}

/** Returns the absolute path to the debug log file on the local machine. */
export async function getLogPath(): Promise<string> {
  return ipcRenderer.invoke('app:get-log-path');
}

/** Reveal the file in the OS file manager (Explorer / Finder), with the file highlighted. */
export async function showItemInFolder(filePath: string): Promise<void> {
  return ipcRenderer.invoke('app:show-item-in-folder', filePath);
}
