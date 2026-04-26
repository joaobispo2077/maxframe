import type { QualityOption } from '../../domain/quality/QualityOption.js';
import type { VideoMetadataGateway } from '../ports/VideoMetadataGateway.js';

import {
  rankAudioOptions,
  rankQualityOptions,
  selectBestAudioQuality,
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
  title: string;
  uploader: string;
  qualities: QualityOption[];
  bestQuality?: QualityOption;
  audioQualities: QualityOption[];
  bestAudioQuality?: QualityOption;
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

    let analysis: Awaited<ReturnType<VideoMetadataGateway['analyzeVideo']>>;
    try {
      analysis = await metadataGateway.analyzeVideo(videoUrl.toString());
    } catch {
      throw new AnalyzeVideoUrlError(
        'METADATA_UNAVAILABLE',
        'Could not analyze this video right now. Please try again.',
      );
    }

    const qualities = rankQualityOptions(analysis.videoQualities);
    const audioQualities = rankAudioOptions(analysis.audioQualities);
    const videoId = parseYoutubeVideoId(videoUrl);

    return {
      url,
      videoId,
      title: analysis.title,
      uploader: analysis.uploader,
      qualities,
      bestQuality: selectBestQuality(qualities),
      audioQualities,
      bestAudioQuality: selectBestAudioQuality(audioQualities),
    };
  };
}
