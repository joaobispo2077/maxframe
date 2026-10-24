export const ANALYZE_FAILURE_MESSAGE =
  "Couldn't load this video's details. Check the link and your connection, then try again.";

export const MISSING_OUTPUT_FILE_MESSAGE =
  "Download finished, but the file isn't in the folder you chose. Look for a new .mp4 or .mkv there, or turn on Debug mode in Settings to see the details.";

const MISSING_OUTPUT_FILE_FROM_MAIN =
  'Download finished but no output file was found next to the path you chose. Check the folder for a new .mp4 or .mkv file, or inspect the yt-dlp error output above.';

/** Map a download failure onto the copy the renderer shows. `Download canceled.` stays exact. */
export function userFacingDownloadError(message: string): string {
  if (
    message === MISSING_OUTPUT_FILE_FROM_MAIN ||
    message === MISSING_OUTPUT_FILE_MESSAGE
  ) {
    return MISSING_OUTPUT_FILE_MESSAGE;
  }
  return message;
}
