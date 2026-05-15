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

// [ffmpeg] frame=  120 fps= 45 q=-1.0 size= 1024kB time=00:00:05.00 bitrate=...
const FFMPEG_FRAME_RE =
  /^\[ffmpeg\]\s+frame=\s*(\d+)\b.*?\btime=(\d+:\d+:\d+(?:\.\d+)?)/;

// [ffmpeg]  45.0% ... or [Merger] ... 12% (when yt-dlp reports postprocess %)
const POSTPROCESS_PERCENT_RE =
  /^\[(?:ffmpeg|Merger|ExtractAudio)\].*?\b([\d.]+)%/;

function lastSegment(raw: string): string {
  const parts = raw.split('\r').filter((s) => s.trim().length > 0);
  return parts.at(-1) ?? raw;
}

function postprocessStatusEvent(
  stage: Exclude<DownloadStage, 'waiting' | 'downloading' | 'done'>,
  detail: string,
  overrides: Partial<
    Pick<YtdlpProgressEvent, 'percent' | 'speedLabel' | 'etaLabel' | 'sizeLabel'>
  > = {},
): YtdlpProgressEvent {
  return {
    percent: 0,
    speedLabel: '',
    etaLabel: '',
    sizeLabel: detail,
    stage,
    ...overrides,
  };
}

function parsePostprocessLine(line: string): YtdlpProgressEvent | null {
  const percentMatch = POSTPROCESS_PERCENT_RE.exec(line);
  if (percentMatch) {
    const percent = parseFloat(percentMatch[1]!);
    const stage = line.startsWith('[ExtractAudio]')
      ? 'extracting-audio'
      : 'merging';
    return postprocessStatusEvent(stage, line.replace(/^\[[^\]]+\]\s*/, ''), {
      percent,
    });
  }

  const ffmpegFrameMatch = FFMPEG_FRAME_RE.exec(line);
  if (ffmpegFrameMatch) {
    return postprocessStatusEvent('merging', '', {
      speedLabel: `frame ${ffmpegFrameMatch[1]}`,
      sizeLabel: `time ${ffmpegFrameMatch[2]}`,
    });
  }

  if (line.startsWith('[ExtractAudio]')) {
    return postprocessStatusEvent(
      'extracting-audio',
      line.replace(/^\[ExtractAudio\]\s*/, ''),
    );
  }
  if (line.startsWith('[Merger]')) {
    return postprocessStatusEvent(
      'merging',
      line.replace(/^\[Merger\]\s*/, ''),
    );
  }
  if (line.startsWith('[ffmpeg]')) {
    return postprocessStatusEvent(
      'merging',
      line.replace(/^\[ffmpeg\]\s*/, ''),
    );
  }

  return null;
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

  return parsePostprocessLine(line);
}
