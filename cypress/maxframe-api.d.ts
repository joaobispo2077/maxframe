type TitleBarInset = {
  height: number;
  padLeft: number;
  padRight: number;
};

type InitialAppState = {
  appName: string;
  status: 'ready';
  isPortable: boolean;
  titleBarInset: TitleBarInset;
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

declare global {
  interface Window {
    maxframeApi: {
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
      getDiagnostics: () => Promise<unknown>;
      getLogPath: () => Promise<string>;
    };
  }
}

export {};
