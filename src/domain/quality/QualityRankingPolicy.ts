import type { QualityOption } from './QualityOption.js';

import { isDownloadableQuality } from './QualityOption.js';

function compareNumberDescending(left: number, right: number): number {
  return right - left;
}

function compareQualityDescending(
  current: QualityOption,
  candidate: QualityOption,
): number {
  if (current.height !== candidate.height) {
    return compareNumberDescending(current.height, candidate.height);
  }

  if (current.fps !== candidate.fps) {
    return compareNumberDescending(current.fps, candidate.fps);
  }

  const currentBitrate = current.videoBitrateKbps ?? 0;
  const candidateBitrate = candidate.videoBitrateKbps ?? 0;

  return compareNumberDescending(currentBitrate, candidateBitrate);
}

function isAudioOnlyQuality(option: QualityOption): boolean {
  return option.hasAudio && !option.hasVideo;
}

function compareAudioDescending(a: QualityOption, b: QualityOption): number {
  return (b.audioBitrateKbps ?? 0) - (a.audioBitrateKbps ?? 0);
}

export function rankAudioOptions(options: QualityOption[]): QualityOption[] {
  return options.filter(isAudioOnlyQuality).toSorted(compareAudioDescending);
}

export function selectBestAudioQuality(
  options: QualityOption[],
): QualityOption | undefined {
  return rankAudioOptions(options)[0];
}

export function rankQualityOptions(options: QualityOption[]): QualityOption[] {
  return options
    .filter(isDownloadableQuality)
    .toSorted(compareQualityDescending);
}

export function selectBestQuality(
  options: QualityOption[],
): QualityOption | undefined {
  return rankQualityOptions(options)[0];
}
