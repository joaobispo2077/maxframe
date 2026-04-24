import type { QualityOption } from '../../domain/quality/QualityOption.js';

export interface VideoMetadataGateway {
  analyzeVideo(url: string): Promise<QualityOption[]>;
}

