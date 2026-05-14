export type DownloadStage =
  | 'waiting'
  | 'downloading'
  | 'extracting-audio'
  | 'merging'
  | 'done';

export type YtdlpProgressEvent = {
  percent: number;
  speedLabel: string;
  etaLabel: string;
  sizeLabel: string;
  stage: DownloadStage;
};

// [download]  10.5% of  100.00MiB at    5.00MiB/s ETA 00:15
const PROGRESS_RE =
  /^\[download\]\s+([\d.]+)%\s+of\s+([\d.]+\s*\S+)\s+at\s+([\d.]+\s*\S+\/s)\s+ETA\s+(\d+:\d+)/;

// [download] 100% of  100.00MiB in 00:20 at   5.12MiB/s
const COMPLETION_RE =
  /^\[download\]\s+100%\s+of\s+([\d.]+\s*\S+)\s+in\s+\d+:\d+\s+at\s+([\d.]+\s*\S+\/s)/;

function lastSegment(raw: string): string {
  const parts = raw.split('\r').filter((s) => s.trim().length > 0);
  return parts.at(-1) ?? raw;
}

function stageEvent(
  stage: Exclude<DownloadStage, 'waiting' | 'downloading'>,
): YtdlpProgressEvent {
  return { percent: 100, speedLabel: '', etaLabel: '', sizeLabel: '', stage };
}

/**
 * Parses a raw yt-dlp stdout/stderr line into a structured progress event.
 * Returns `null` for lines that carry no actionable progress information
 * (e.g. destination announcements, info messages).
 *
 * Handles `\r`-delimited batches by extracting the last segment.
 */
export function parseYtdlpProgressLine(
  rawLine: string,
): YtdlpProgressEvent | null {
  const line = lastSegment(rawLine).trim();

  const progressMatch = PROGRESS_RE.exec(line);
  if (progressMatch) {
    return {
      percent: parseFloat(progressMatch[1]!),
      sizeLabel: progressMatch[2]!.trim(),
      speedLabel: progressMatch[3]!.trim(),
      etaLabel: progressMatch[4]!,
      stage: 'downloading',
    };
  }

  const completionMatch = COMPLETION_RE.exec(line);
  if (completionMatch) {
    return {
      percent: 100,
      sizeLabel: completionMatch[1]!.trim(),
      speedLabel: completionMatch[2]!.trim(),
      etaLabel: 'done',
      stage: 'done',
    };
  }

  if (line.startsWith('[ExtractAudio]')) return stageEvent('extracting-audio');
  if (line.startsWith('[Merger]')) return stageEvent('merging');
  if (line.startsWith('[ffmpeg]')) return stageEvent('merging');

  return null;
}
