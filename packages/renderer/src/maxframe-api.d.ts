type InitialAppState = {
  appName: string;
  status: 'ready';
};

type QualityOption = {
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

type AnalyzeVideoUrlResult = {
  url: string;
  videoId: string | undefined;
  title: string;
  uploader: string;
  qualities: QualityOption[];
  bestQuality?: QualityOption;
  audioQualities: QualityOption[];
  bestAudioQuality?: QualityOption;
};

type DownloadVideoRequest = {
  url: string;
  formatId: string;
  hasAudio: boolean;
  suggestedFileName: string;
  outputMode: 'mp3' | 'mp4';
};

type DownloadVideoResult = {
  outputPath: string;
};

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

type MaxframeApi = {
  getInitialAppState: () => Promise<InitialAppState>;
  ping: (payload: string) => Promise<string>;
  analyzeVideoUrl: (url: string) => Promise<AnalyzeVideoUrlResult>;
  downloadVideo: (
    request: DownloadVideoRequest,
  ) => Promise<DownloadVideoResult>;
  subscribeDownloadProgress: (
    listener: (payload: { line: string }) => void,
  ) => () => void;
  cancelDownload: () => Promise<{ canceled: boolean }>;
  setDebugMode: (on: boolean) => Promise<void>;
  getDiagnostics: () => Promise<DiagnosticsReport>;
};

declare global {
  interface Window {
    maxframeApi: MaxframeApi;
  }
}

export {};
