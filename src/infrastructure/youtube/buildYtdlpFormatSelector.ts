/**
 * yt-dlp `-f` value for a chosen format row.
 * - MP3 mode always requests best audio regardless of formatId.
 * - MP4 mode: video-only rows merge best audio when possible.
 */
export function buildYtdlpFormatSelector(
  formatId: string,
  hasAudio: boolean,
  outputMode: 'mp3' | 'mp4',
): string {
  if (outputMode === 'mp3') {
    return 'bestaudio/best';
  }
  if (hasAudio) {
    return formatId;
  }
  return `${formatId}+bestaudio/best`;
}
