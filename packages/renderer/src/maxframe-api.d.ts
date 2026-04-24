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
  qualities: QualityOption[];
  bestQuality?: QualityOption;
};

type DownloadVideoRequest = {
  url: string;
  formatId: string;
  hasAudio: boolean;
  suggestedFileName: string;
};

type DownloadVideoResult = {
  outputPath: string;
};

type MaxframeApi = {
  getInitialAppState: () => Promise<InitialAppState>;
  ping: (payload: string) => Promise<string>;
  analyzeVideoUrl: (url: string) => Promise<AnalyzeVideoUrlResult>;
  downloadVideo: (
    request: DownloadVideoRequest,
  ) => Promise<DownloadVideoResult>;
};

declare global {
  interface Window {
    maxframeApi: MaxframeApi;
  }
}

export {};

