import type { AnalyzeVideoResult } from './analyzeVideoResultType.js';

export type BestDownloadTarget = {
  formatId: string;
  hasAudio: boolean;
  label: string;
};

export function resolveBestDownload(
  result: AnalyzeVideoResult,
  outputMode: 'mp3' | 'mp4',
): BestDownloadTarget | undefined {
  if (outputMode === 'mp4') {
    const best = result.bestQuality;
    if (!best) {
      return undefined;
    }
    return {
      formatId: best.formatId,
      hasAudio: best.hasAudio,
      label: best.resolutionLabel,
    };
  }

  const bestAudio = result.bestAudioQuality;
  if (bestAudio) {
    return {
      formatId: bestAudio.formatId,
      hasAudio: true,
      label: bestAudio.resolutionLabel,
    };
  }

  const fallback = result.bestQuality;
  if (fallback && result.qualities.length > 0) {
    return {
      formatId: fallback.formatId,
      hasAudio: true,
      label: 'best audio (from video)',
    };
  }

  return undefined;
}
