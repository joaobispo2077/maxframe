/**
 * True when yt-dlp must merge separate streams (video + audio), which requires ffmpeg.
 */
export function ytdlpDownloadNeedsFfmpeg(hasAudio: boolean): boolean {
  return !hasAudio;
}
