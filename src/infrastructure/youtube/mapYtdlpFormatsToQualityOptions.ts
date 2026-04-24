import type { QualityOption } from '../../domain/quality/QualityOption.js';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return undefined;
}

function asString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  return undefined;
}

function resolutionLabelFromHeight(height: number, formatNote?: string): string {
  const note = formatNote?.trim();
  if (note && /^\d+p(\d+)?$/i.test(note)) {
    return note;
  }
  if (height <= 0) {
    return 'unknown';
  }
  if (height >= 4320) {
    return '4320p';
  }
  if (height >= 2160) {
    return '2160p';
  }
  if (height >= 1440) {
    return '1440p';
  }
  if (height >= 1080) {
    return '1080p';
  }
  if (height >= 720) {
    return '720p';
  }
  if (height >= 480) {
    return '480p';
  }
  if (height >= 360) {
    return '360p';
  }
  if (height >= 240) {
    return '240p';
  }
  return `${height}p`;
}

function mapOneFormat(entry: unknown): QualityOption | undefined {
  if (!isRecord(entry)) {
    return undefined;
  }

  const formatIdRaw = entry.format_id;
  const formatId =
    typeof formatIdRaw === 'string' || typeof formatIdRaw === 'number'
      ? String(formatIdRaw)
      : undefined;
  if (!formatId) {
    return undefined;
  }

  const ext = asString(entry.ext) ?? 'unknown';
  const vcodec = asString(entry.vcodec) ?? 'none';
  const acodec = asString(entry.acodec) ?? 'none';
  const hasVideo = vcodec !== 'none';
  const hasAudio = acodec !== 'none';

  if (!hasVideo) {
    return undefined;
  }

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
    hasVideo,
    hasAudio,
    videoBitrateKbps,
    audioBitrateKbps,
  };
}

/**
 * Maps yt-dlp `-J` / `--dump-single-json` payload into {@link QualityOption} rows
 * (video-capable formats only).
 */
export function mapYtdlpFormatsToQualityOptions(payload: unknown): QualityOption[] {
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
