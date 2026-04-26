import type { QualityOption } from '../../domain/quality/QualityOption.js';

import {
  asNumber,
  asString,
  formatIdFromEntry,
  isRecord,
  type UnknownRecord,
} from './ytdlpParseHelpers.js';

/** Descending height thresholds → common resolution labels. */
const RESOLUTION_HEIGHT_BUCKETS: { minHeight: number; label: string }[] = [
  { minHeight: 4320, label: '4320p' },
  { minHeight: 2160, label: '2160p' },
  { minHeight: 1440, label: '1440p' },
  { minHeight: 1080, label: '1080p' },
  { minHeight: 720, label: '720p' },
  { minHeight: 480, label: '480p' },
  { minHeight: 360, label: '360p' },
  { minHeight: 240, label: '240p' },
];

function resolutionLabelFromHeight(
  height: number,
  formatNote?: string,
): string {
  const note = formatNote?.trim();
  if (note && /^\d+p(\d+)?$/i.test(note)) {
    return note;
  }
  if (height <= 0) {
    return 'unknown';
  }
  for (const { minHeight, label } of RESOLUTION_HEIGHT_BUCKETS) {
    if (height >= minHeight) {
      return label;
    }
  }
  return `${height}p`;
}

function qualityOptionFromVideoEntry(
  formatId: string,
  entry: UnknownRecord,
): QualityOption {
  const ext = asString(entry.ext) ?? 'unknown';
  const acodec = asString(entry.acodec) ?? 'none';
  const width = asNumber(entry.width) ?? 0;
  const height = asNumber(entry.height) ?? 0;
  const fps = asNumber(entry.fps) ?? 30;
  const formatNote = asString(entry.format_note);
  const videoBitrateKbps =
    asNumber(entry.vbr) ?? asNumber(entry.tbr) ?? undefined;
  const audioBitrateKbps = asNumber(entry.abr) ?? undefined;

  return {
    formatId,
    container: ext,
    resolutionLabel: resolutionLabelFromHeight(height, formatNote),
    width,
    height,
    fps,
    hasVideo: true,
    hasAudio: acodec !== 'none',
    videoBitrateKbps,
    audioBitrateKbps,
  };
}

function mapOneFormat(entry: unknown): QualityOption | undefined {
  if (!isRecord(entry)) {
    return undefined;
  }

  const formatId = formatIdFromEntry(entry);
  if (!formatId) {
    return undefined;
  }

  const vcodec = asString(entry.vcodec) ?? 'none';
  if (vcodec === 'none') {
    return undefined;
  }

  return qualityOptionFromVideoEntry(formatId, entry);
}

/**
 * Maps yt-dlp `-J` / `--dump-single-json` payload into {@link QualityOption} rows
 * (video-capable formats only).
 */
export function mapYtdlpFormatsToQualityOptions(
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
    const mapped = mapOneFormat(item);
    if (!mapped || seen.has(mapped.formatId)) {
      continue;
    }
    seen.add(mapped.formatId);
    out.push(mapped);
  }

  return out;
}
