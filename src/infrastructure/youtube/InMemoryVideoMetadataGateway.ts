import type { VideoMetadataGateway } from '../../application/ports/VideoMetadataGateway.js';
import type { QualityOption } from '../../domain/quality/QualityOption.js';

const DEFAULT_QUALITY_OPTIONS: QualityOption[] = [
  {
    formatId: '137',
    container: 'mp4',
    resolutionLabel: '1080p',
    width: 1920,
    height: 1080,
    fps: 30,
    hasVideo: true,
    hasAudio: false,
    videoBitrateKbps: 4200,
  },
  {
    formatId: '299',
    container: 'mp4',
    resolutionLabel: '1080p60',
    width: 1920,
    height: 1080,
    fps: 60,
    hasVideo: true,
    hasAudio: false,
    videoBitrateKbps: 5200,
  },
  {
    formatId: '22',
    container: 'mp4',
    resolutionLabel: '720p',
    width: 1280,
    height: 720,
    fps: 30,
    hasVideo: true,
    hasAudio: true,
    videoBitrateKbps: 1800,
    audioBitrateKbps: 192,
  },
];

export function createInMemoryVideoMetadataGateway(
  qualityOptions: QualityOption[] = DEFAULT_QUALITY_OPTIONS,
): VideoMetadataGateway {
  return {
    async analyzeVideo(_url: string): Promise<QualityOption[]> {
      return qualityOptions;
    },
  };
}
