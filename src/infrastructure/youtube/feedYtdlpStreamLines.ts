export type YtdlpStreamLineState = {
  buffer: string;
};

export function createYtdlpStreamLineState(): YtdlpStreamLineState {
  return { buffer: '' };
}

function emitTrimmedLine(line: string, onLine: (line: string) => void): void {
  const trimmed = line.replace(/\r$/, '').trim();
  if (trimmed.length > 0) {
    onLine(trimmed);
  }
}

/**
 * Splits yt-dlp pipe output into logical lines. yt-dlp overwrites download
 * progress with `\r` without `\n`; treat `\r` like a line boundary.
 */
export function feedYtdlpStreamLines(
  state: YtdlpStreamLineState,
  chunk: string,
  onLine: (line: string) => void,
): void {
  state.buffer += chunk;
  for (;;) {
    const nl = state.buffer.indexOf('\n');
    const cr = state.buffer.indexOf('\r');

    if (nl >= 0 && (cr < 0 || nl <= cr)) {
      emitTrimmedLine(state.buffer.slice(0, nl), onLine);
      state.buffer = state.buffer.slice(nl + 1);
      continue;
    }

    if (cr >= 0) {
      emitTrimmedLine(state.buffer.slice(0, cr), onLine);
      state.buffer = state.buffer.slice(cr + 1);
      continue;
    }

    break;
  }
}

export function flushYtdlpStreamLines(
  state: YtdlpStreamLineState,
  onLine: (line: string) => void,
): void {
  emitTrimmedLine(state.buffer, onLine);
  state.buffer = '';
}
