import type { IpcRendererEvent } from 'electron';

import { ipcRenderer } from 'electron';

export type InitialAppState = {
  appName: string;
  status: 'ready';
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
  qualities: QualityOption[];
  bestQuality?: QualityOption;
};

export type DownloadVideoRequest = {
  url: string;
  formatId: string;
  hasAudio: boolean;
  suggestedFileName: string;
};

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
