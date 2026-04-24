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
