/**
 * True when yt-dlp needs ffmpeg for merge, recode, or audio extraction.
 */
export function ytdlpDownloadNeedsFfmpeg(
  _hasAudio: boolean,
  outputMode: 'mp3' | 'mp4',
): boolean {
  return outputMode === 'mp3' || outputMode === 'mp4';
}
