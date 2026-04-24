import { rankQualityOptions, selectBestQuality } from '../../domain/quality/QualityRankingPolicy.js';
import type { QualityOption } from '../../domain/quality/QualityOption.js';
import type { VideoMetadataGateway } from '../ports/VideoMetadataGateway.js';

export type AnalyzeVideoUrlResult = {
  url: string;
  qualities: QualityOption[];
  bestQuality?: QualityOption;
};

const YOUTUBE_URL_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
]);

function assertValidYoutubeUrl(url: string): void {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('Invalid URL format.');
  }

  if (!YOUTUBE_URL_HOSTS.has(parsedUrl.hostname)) {
    throw new Error('Only YouTube URLs are supported.');
  }
}

export function createAnalyzeVideoUrlUseCase(
  metadataGateway: VideoMetadataGateway,
) {
  return async function analyzeVideoUrl(
    url: string,
  ): Promise<AnalyzeVideoUrlResult> {
    assertValidYoutubeUrl(url);

    const rawQualities = await metadataGateway.analyzeVideo(url);
    const qualities = rankQualityOptions(rawQualities);

    return {
      url,
      qualities,
      bestQuality: selectBestQuality(qualities),
    };
  };
}
