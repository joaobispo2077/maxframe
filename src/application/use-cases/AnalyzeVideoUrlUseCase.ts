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
import {
  canonicalYoutubeWatchUrl,
  parseYoutubeVideoId,
} from '../../domain/video/youtubeVideoId.js';
import { AnalyzeVideoUrlError } from '../errors/AnalyzeVideoErrors.js';

const METADATA_UNAVAILABLE_MESSAGE =
  'Could not analyze this video right now. Please try again.';
const MAX_TECHNICAL_DETAIL_LENGTH = 500;

function boundTechnicalDetail(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw.trim().slice(0, MAX_TECHNICAL_DETAIL_LENGTH);
}

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
      analysis = await metadataGateway.analyzeVideo(
        canonicalYoutubeWatchUrl(videoUrl),
      );
    } catch (error: unknown) {
      throw new AnalyzeVideoUrlError(
        'METADATA_UNAVAILABLE',
        METADATA_UNAVAILABLE_MESSAGE,
        boundTechnicalDetail(error),
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
