import {
  DOWNLOAD_CANCELED_MESSAGE,
  stripIpcInvokePrefix,
} from '@src/domain/errors/ipcErrorMessage.js';

export const ANALYZE_FAILURE_MESSAGE =
  "Couldn't load this video's details. Check the link and your connection, then try again.";

export const MISSING_OUTPUT_FILE_MESSAGE =
  "Download finished, but the file isn't in the folder you chose. Look for a new .mp4 or .mkv there, or turn on Debug mode in Settings to see the details.";

export const YOUTUBE_BLOCKED_MESSAGE =
  "YouTube blocked this download. This often happens when the app's yt-dlp is out of date. Try again in a few minutes.";

export const GENERIC_DOWNLOAD_ERROR_MESSAGE =
  "Couldn't finish this download. Try again, or use Copy report to save the details.";

const MISSING_OUTPUT_FILE_FROM_MAIN =
  'Download finished but no output file was found next to the path you chose. Check the folder for a new .mp4 or .mkv file, or inspect the yt-dlp error output above.';

const DOWNLOAD_ALREADY_IN_PROGRESS_MESSAGE =
  'A download is already in progress.';

const ALREADY_USER_FACING = new Set([
  DOWNLOAD_CANCELED_MESSAGE,
  MISSING_OUTPUT_FILE_MESSAGE,
  YOUTUBE_BLOCKED_MESSAGE,
  GENERIC_DOWNLOAD_ERROR_MESSAGE,
  DOWNLOAD_ALREADY_IN_PROGRESS_MESSAGE,
]);

function isYoutubeBlocked(message: string): boolean {
  return (
    /HTTP Error 403\b/i.test(message) || /\b403:\s*Forbidden\b/i.test(message)
  );
}

/** Map a download failure onto the copy the renderer shows. `Download canceled.` stays exact. */
export function userFacingDownloadError(message: string): string {
  const core = stripIpcInvokePrefix(message);
  if (ALREADY_USER_FACING.has(core)) {
    return core;
  }
  if (core === MISSING_OUTPUT_FILE_FROM_MAIN) {
    return MISSING_OUTPUT_FILE_MESSAGE;
  }
  if (isYoutubeBlocked(core)) {
    return YOUTUBE_BLOCKED_MESSAGE;
  }
  return GENERIC_DOWNLOAD_ERROR_MESSAGE;
}
