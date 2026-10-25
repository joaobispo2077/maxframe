import type { QualityOption } from '../../domain/quality/QualityOption.js';

import { mapYtdlpFormatsToQualityOptions } from './mapYtdlpFormatsToQualityOptions.js';
import { asString, formatIdFromEntry, isRecord } from './ytdlpParseHelpers.js';

/**
 * Row used when the e2e fixture is a local file.
 * yt-dlp's generic extractor reports one `mp4` format and leaves `vcodec` null,
 * so the normal mapper drops it. `-f mp4` downloads that muxed file. The
 * video-only selector (`mp4+bestaudio`) does not exist for this format, so
 * `hasAudio` stays true and MP3 still uses `bestaudio/best` plus ffmpeg.
 */
const GENERIC_FIXTURE_VIDEO_ROW: QualityOption = {
  formatId: 'mp4',
  container: 'mp4',
  resolutionLabel: 'unknown',
  width: 0,
  height: 0,
  fps: 0,
  hasVideo: true,
  hasAudio: true,
};

function isSingleGenericMp4(payload: unknown): boolean {
  if (!isRecord(payload) || asString(payload.extractor) !== 'generic') {
    return false;
  }
  const formats = payload.formats;
  if (
    !Array.isArray(formats) ||
    formats.length !== 1 ||
    !isRecord(formats[0])
  ) {
    return false;
  }
  const entry = formats[0];
  if (formatIdFromEntry(entry) !== 'mp4' || asString(entry.ext) !== 'mp4') {
    return false;
  }
  return entry.vcodec === null || entry.vcodec === undefined;
}

/**
 * Normal yt-dlp format rows, plus one video row for the e2e fixture's generic
 * MP4 when the fixture hook is active. Normal mode is unchanged.
 */
export function videoQualitiesForYtdlpPayload(
  payload: unknown,
  fixtureActive: boolean,
): QualityOption[] {
  const mapped = mapYtdlpFormatsToQualityOptions(payload);
  if (!fixtureActive || !isSingleGenericMp4(payload)) {
    return mapped;
  }
  return [{ ...GENERIC_FIXTURE_VIDEO_ROW }];
}
