import {
  GENERIC_DOWNLOAD_ERROR_MESSAGE,
  MISSING_OUTPUT_FILE_MESSAGE,
  YOUTUBE_BLOCKED_MESSAGE,
  userFacingDownloadError,
} from '@ui/lib/userFacingErrors';
import { describe, expect, it } from 'vitest';

const MISSING_FROM_MAIN =
  'Download finished but no output file was found next to the path you chose. Check the folder for a new .mp4 or .mkv file, or inspect the yt-dlp error output above.';

function ipc(message: string): string {
  return `Error invoking remote method 'app:download-video': Error: ${message}`;
}

describe('userFacingDownloadError', () => {
  it('maps a realistic IPC-prefixed missing-file error', () => {
    expect(userFacingDownloadError(ipc(MISSING_FROM_MAIN))).toBe(
      MISSING_OUTPUT_FILE_MESSAGE,
    );
  });

  it('maps a realistic IPC-prefixed 403 log to the blocked-download message', () => {
    const log =
      'ERROR: [youtube] dQw4w9WgXcQ: Unable to download API page: HTTP Error 403: Forbidden';
    const mapped = userFacingDownloadError(ipc(log));
    expect(mapped).toBe(YOUTUBE_BLOCKED_MESSAGE);
    expect(mapped).not.toContain('Error invoking remote method');
    expect(mapped).not.toContain('ERROR:');
  });

  it('maps 403: Forbidden without the HTTP Error label', () => {
    expect(userFacingDownloadError('yt-dlp: 403: Forbidden')).toBe(
      YOUTUBE_BLOCKED_MESSAGE,
    );
  });

  it('does not treat nearby status codes as a 403', () => {
    expect(userFacingDownloadError('HTTP Error 4030: Forbidden')).toBe(
      GENERIC_DOWNLOAD_ERROR_MESSAGE,
    );
    expect(userFacingDownloadError('HTTP Error 404: Not Found')).toBe(
      GENERIC_DOWNLOAD_ERROR_MESSAGE,
    );
  });

  it('replaces an unrecognized IPC-prefixed log with the generic message', () => {
    const log = 'ERROR: [youtube] boom: unable to extract player response';
    const mapped = userFacingDownloadError(ipc(log));
    expect(mapped).toBe(GENERIC_DOWNLOAD_ERROR_MESSAGE);
    expect(mapped).not.toContain('unable to extract');
    expect(mapped).not.toContain('Error invoking remote method');
  });

  it('keeps Download canceled. exact, including after the IPC prefix', () => {
    expect(userFacingDownloadError('Download canceled.')).toBe(
      'Download canceled.',
    );
    expect(userFacingDownloadError(ipc('Download canceled.'))).toBe(
      'Download canceled.',
    );
  });

  it('keeps A download is already in progress. after the IPC prefix', () => {
    expect(
      userFacingDownloadError(ipc('A download is already in progress.')),
    ).toBe('A download is already in progress.');
  });

  it('keeps an already mapped message', () => {
    expect(userFacingDownloadError(YOUTUBE_BLOCKED_MESSAGE)).toBe(
      YOUTUBE_BLOCKED_MESSAGE,
    );
    expect(userFacingDownloadError(MISSING_OUTPUT_FILE_MESSAGE)).toBe(
      MISSING_OUTPUT_FILE_MESSAGE,
    );
  });
});
