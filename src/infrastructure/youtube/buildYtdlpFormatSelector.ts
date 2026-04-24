/**
 * yt-dlp `-f` value for a chosen format row. Video-only rows merge best audio when possible.
 */
export function buildYtdlpFormatSelector(
  formatId: string,
  hasAudio: boolean,
): string {
  if (hasAudio) {
    return formatId;
  }
  return `${formatId}+bestaudio/best`;
}
