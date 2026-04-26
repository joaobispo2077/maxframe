import type { QualityOption } from '../../domain/quality/QualityOption.js';

import {
  asNumber,
  asString,
  formatIdFromEntry,
  isRecord,
} from './ytdlpParseHelpers.js';

/**
 * Maps yt-dlp `-J` / `--dump-single-json` payload into {@link QualityOption} rows
 * for audio-only formats (vcodec === 'none', acodec !== 'none').
 */
export function mapYtdlpAudioFormatsToQualityOptions(
  payload: unknown,
): QualityOption[] {
  if (!isRecord(payload)) {
    return [];
  }
  const formats = payload.formats;
  if (!Array.isArray(formats)) {
    return [];
  }

  const seen = new Set<string>();
  const out: QualityOption[] = [];

  for (const item of formats) {
    if (!isRecord(item)) {
      continue;
    }
    const formatId = formatIdFromEntry(item);
    if (!formatId || seen.has(formatId)) {
      continue;
    }
    const vcodec = asString(item.vcodec) ?? 'none';
    if (vcodec !== 'none') {
      continue;
    }
    const acodec = asString(item.acodec) ?? 'none';
    if (acodec === 'none') {
      continue;
    }
    const audioBitrateKbps = asNumber(item.abr) ?? undefined;
    seen.add(formatId);
    out.push({
      formatId,
      container: asString(item.ext) ?? 'unknown',
      resolutionLabel: 'Audio-only',
      width: 0,
      height: 0,
      fps: 0,
      hasVideo: false,
      hasAudio: true,
      audioBitrateKbps,
    });
  }

  return out;
}
