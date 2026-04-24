import { AnalyzeVideoUrlError } from '../errors/AnalyzeVideoErrors.js';
import { rankQualityOptions, selectBestQuality } from '../../domain/quality/QualityRankingPolicy.js';
import type { QualityOption } from '../../domain/quality/QualityOption.js';
import { InvalidVideoUrlError, createVideoUrl } from '../../domain/video/VideoUrl.js';
import type { VideoMetadataGateway } from '../ports/VideoMetadataGateway.js';

export type AnalyzeVideoUrlResult = {
  url: string;
  qualities: QualityOption[];
  bestQuality?: QualityOption;
};

export function createAnalyzeVideoUrlUseCase(
  metadataGateway: VideoMetadataGateway,
) {
  return async function analyzeVideoUrl(
    url: string,
  ): Promise<AnalyzeVideoUrlResult> {
    let videoUrl: URL;
    try {
      videoUrl = createVideoUrl(url);
    } catch (error) {
      if (error instanceof InvalidVideoUrlError) {
        throw new AnalyzeVideoUrlError('INVALID_URL', error.message);
      }
      throw error;
    }

    let rawQualities: QualityOption[];
    try {
      rawQualities = await metadataGateway.analyzeVideo(videoUrl.toString());
    } catch {
      throw new AnalyzeVideoUrlError(
        'METADATA_UNAVAILABLE',
        'Could not analyze this video right now. Please try again.',
      );
    }
    const qualities = rankQualityOptions(rawQualities);

    return {
      url,
      qualities,
      bestQuality: selectBestQuality(qualities),
    };
  };
}
