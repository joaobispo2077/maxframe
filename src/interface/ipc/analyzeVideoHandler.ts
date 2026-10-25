import type { VideoMetadataGateway } from '../../application/ports/VideoMetadataGateway.js';

import { createAnalyzeVideoUrlUseCase } from '../../application/use-cases/AnalyzeVideoUrlUseCase.js';
import { resolveYtdlpMediaUrl } from '../../infrastructure/e2e/e2eTestHook.js';
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
  const ytdlpGateway = createYtdlpVideoMetadataGateway();
  const fakeGateway = createInMemoryVideoMetadataGateway();
  return {
    async analyzeVideo(url: string) {
      const mediaUrl = resolveYtdlpMediaUrl(url);
      if (mediaUrl !== url) {
        return ytdlpGateway.analyzeVideo(mediaUrl);
      }
      if (process.env.MAXFRAME_FAKE_VIDEO_METADATA === '1') {
        return fakeGateway.analyzeVideo(url);
      }
      return ytdlpGateway.analyzeVideo(url);
    },
  };
}

export const analyzeVideoHandler = createAnalyzeVideoHandler(
  createDefaultMetadataGateway(),
);
