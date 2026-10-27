import {
  isDownloadCanceled,
  stripIpcInvokePrefix,
} from '@src/domain/errors/ipcErrorMessage.js';
import { describe, expect, it } from 'vitest';

const MISSING_FROM_MAIN =
  'Download finished but no output file was found next to the path you chose. Check the folder for a new .mp4 or .mkv file, or inspect the yt-dlp error output above.';

describe('stripIpcInvokePrefix', () => {
  it('removes the Electron invoke prefix and the Error: wrapper', () => {
    const raw = `Error invoking remote method 'app:download-video': Error: ${MISSING_FROM_MAIN}`;
    expect(stripIpcInvokePrefix(raw)).toBe(MISSING_FROM_MAIN);
  });

  it('removes the prefix when Electron omits the Error: wrapper', () => {
    expect(
      stripIpcInvokePrefix(
        "Error invoking remote method 'app:download-video': Download canceled.",
      ),
    ).toBe('Download canceled.');
  });

  it('leaves messages that did not come from ipcRenderer.invoke', () => {
    expect(stripIpcInvokePrefix('Error: keep me')).toBe('Error: keep me');
    expect(stripIpcInvokePrefix(MISSING_FROM_MAIN)).toBe(MISSING_FROM_MAIN);
  });

  it('keeps a yt-dlp log that follows the prefix, including later lines', () => {
    const raw = [
      "Error invoking remote method 'app:download-video': Error: ERROR: [youtube] x: HTTP Error 403: Forbidden",
      '[debug] destination C:\\Users\\Joao\\video.mp4',
    ].join('\n');
    expect(stripIpcInvokePrefix(raw)).toBe(
      [
        'ERROR: [youtube] x: HTTP Error 403: Forbidden',
        '[debug] destination C:\\Users\\Joao\\video.mp4',
      ].join('\n'),
    );
  });
});

describe('isDownloadCanceled', () => {
  it('matches the bare and the IPC-prefixed cancel message', () => {
    expect(isDownloadCanceled('Download canceled.')).toBe(true);
    expect(
      isDownloadCanceled(
        "Error invoking remote method 'app:download-video': Error: Download canceled.",
      ),
    ).toBe(true);
    expect(isDownloadCanceled('Download failed')).toBe(false);
  });
});
