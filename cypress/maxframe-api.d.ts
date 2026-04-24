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

declare global {
  interface Window {
    maxframeApi: {
      getInitialAppState: () => Promise<InitialAppState>;
      ping: (payload: string) => Promise<string>;
      analyzeVideoUrl: (url: string) => Promise<AnalyzeVideoUrlResult>;
    };
  }
}

export {};
