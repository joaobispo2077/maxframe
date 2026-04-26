import type { QualityOption } from '../../domain/quality/QualityOption.js';

export type VideoAnalysis = {
  videoQualities: QualityOption[];
  audioQualities: QualityOption[];
  title: string;
  uploader: string;
};

export interface VideoMetadataGateway {
  analyzeVideo(url: string): Promise<VideoAnalysis>;
}
