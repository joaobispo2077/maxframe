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
  qualities: QualityOption[];
  bestQuality?: QualityOption;
};

type MaxframeApi = {
  getInitialAppState: () => Promise<InitialAppState>;
  ping: (payload: string) => Promise<string>;
  analyzeVideoUrl: (url: string) => Promise<AnalyzeVideoUrlResult>;
};

declare global {
  interface Window {
    maxframeApi: MaxframeApi;
  }
}

export {};

