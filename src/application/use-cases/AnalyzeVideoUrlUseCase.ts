import type { QualityOption } from '../../domain/quality/QualityOption.js';
import type { VideoMetadataGateway } from '../ports/VideoMetadataGateway.js';

import {
  rankQualityOptions,
  selectBestQuality,
} from '../../domain/quality/QualityRankingPolicy.js';
import {
  InvalidVideoUrlError,
  createVideoUrl,
} from '../../domain/video/VideoUrl.js';
import { parseYoutubeVideoId } from '../../domain/video/youtubeVideoId.js';
import { AnalyzeVideoUrlError } from '../errors/AnalyzeVideoErrors.js';

export type AnalyzeVideoUrlResult = {
  url: string;
  /** Parsed 11-character YouTube id when the URL shape allows it; otherwise undefined. */
  videoId: string | undefined;
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
    const videoId = parseYoutubeVideoId(videoUrl);

    return {
      url,
      videoId,
      qualities,
      bestQuality: selectBestQuality(qualities),
    };
  };
}
