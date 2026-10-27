export const DOWNLOAD_CANCELED_MESSAGE = 'Download canceled.';

/**
 * Electron `ipcRenderer.invoke` rejects with
 * `Error invoking remote method '<channel>': Error: <original>`.
 * Callers match the original message, so the prefix is removed in one place.
 */
export function stripIpcInvokePrefix(message: string): string {
  const match = /^Error invoking remote method '[^']*': /.exec(message);
  if (!match) {
    return message;
  }
  const rest = message.slice(match[0].length);
  if (rest.startsWith('Error: ')) {
    return rest.slice('Error: '.length);
  }
  return rest;
}

export function isDownloadCanceled(message: string): boolean {
  return stripIpcInvokePrefix(message) === DOWNLOAD_CANCELED_MESSAGE;
}
