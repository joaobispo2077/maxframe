import type { QualityOption } from '../../../../src/domain/quality/QualityOption.js';

export function formatVideoBitrateKbps(
  kbps: number | undefined,
): string | null {
  if (kbps == null || !Number.isFinite(kbps)) {
    return null;
  }
  return `~${Math.round(kbps)} kbps video`;
}

export function formatAudioBitrateKbps(
  kbps: number | undefined,
): string | null {
  if (kbps == null || !Number.isFinite(kbps)) {
    return null;
  }
  return `~${Math.round(kbps)} kbps audio`;
}

/** Plain language for why yt-dlp may merge audio on download. */
export function streamKindLabel(quality: QualityOption): string {
  if (quality.hasVideo && quality.hasAudio) {
    return 'Video + audio in one file';
  }
  if (quality.hasVideo) {
    return 'Video only — MP4 download adds AAC audio for social upload compatibility';
  }
  return 'Not a primary video row';
}

/**
 * One-line comparison of a row vs the app-ranked best (same policy as server ranking).
 */
export function describeQualityAgainstBest(
  quality: QualityOption,
  best: QualityOption | undefined,
): string {
  if (!best) {
    return 'No top-ranked row to compare against for this list.';
  }
  if (quality.formatId === best.formatId) {
    return 'This is the app’s top-ranked row (height, then fps, then listed video bitrate).';
  }
  if (quality.height < best.height) {
    return 'Lower vertical resolution than the top-ranked row.';
  }
  if (quality.height > best.height) {
    return 'Higher vertical resolution than the top-ranked row (different format trade-offs may still apply).';
  }
  if (quality.fps < best.fps) {
    return 'Same height as top-ranked row, lower frame rate.';
  }
  if (quality.fps > best.fps) {
    return 'Same height as top-ranked row, higher frame rate (bitrate or other fields set the rank).';
  }
  const qBitrate = quality.videoBitrateKbps ?? 0;
  const bBitrate = best.videoBitrateKbps ?? 0;
  if (qBitrate < bBitrate) {
    return 'Same height and fps; lower listed video bitrate than the top-ranked row.';
  }
  if (qBitrate > bBitrate) {
    return 'Same height and fps; higher listed video bitrate than the top-ranked row (rank uses more than bitrate alone).';
  }
  return 'Same height, fps, and listed video bitrate as the top-ranked row (different format id).';
}
