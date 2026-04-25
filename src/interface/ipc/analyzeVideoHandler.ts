import type { VideoMetadataGateway } from '../../application/ports/VideoMetadataGateway.js';

import { createAnalyzeVideoUrlUseCase } from '../../application/use-cases/AnalyzeVideoUrlUseCase.js';
import { createInMemoryVideoMetadataGateway } from '../../infrastructure/youtube/InMemoryVideoMetadataGateway.js';
import { createYtdlpVideoMetadataGateway } from '../../infrastructure/youtube/YtdlpVideoMetadataGateway.js';

export function createAnalyzeVideoHandler(
  metadataGateway: VideoMetadataGateway,
) {
  const analyzeVideoUrl = createAnalyzeVideoUrlUseCase(metadataGateway);
  return async function analyzeVideoHandler(url: string) {
    return analyzeVideoUrl(url);
  };
}

function createDefaultMetadataGateway(): VideoMetadataGateway {
  if (process.env.MAXFRAME_FAKE_VIDEO_METADATA === '1') {
    return createInMemoryVideoMetadataGateway();
  }
  return createYtdlpVideoMetadataGateway();
}

export const analyzeVideoHandler = createAnalyzeVideoHandler(
  createDefaultMetadataGateway(),
);
