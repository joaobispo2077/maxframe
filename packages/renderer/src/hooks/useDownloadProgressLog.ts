import { useCallback, useEffect, useState } from 'react';

const MAX_LINE_LENGTH = 140;
const TRAILING_LINE_COUNT = 8;

/**
 * Buffers trimmed yt-dlp / ffmpeg log lines for the active download card.
 */
export function useDownloadProgressLog(): {
  lines: string[];
  clear: () => void;
} {
  const [lines, setLines] = useState<string[]>([]);
  const clear = useCallback(() => {
    setLines([]);
  }, []);

  useEffect(() => {
    const api = window.maxframeApi;
    if (typeof api.subscribeDownloadProgress !== 'function') {
      return undefined;
    }
    return api.subscribeDownloadProgress(({ line }) => {
      const trimmed =
        line.length > MAX_LINE_LENGTH
          ? `${line.slice(0, MAX_LINE_LENGTH - 3)}…`
          : line;
      setLines((prev) =>
        [...prev, trimmed].slice(-TRAILING_LINE_COUNT),
      );
    });
  }, []);

  return { lines, clear };
}
