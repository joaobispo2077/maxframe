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
