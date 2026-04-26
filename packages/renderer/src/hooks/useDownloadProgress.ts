import { useCallback, useEffect, useRef, useState } from 'react';

import {
  type DownloadStage,
  parseYtdlpProgressLine,
} from '@src/domain/progress/parseYtdlpProgressLine';

export type DownloadProgressState = {
  active: boolean;
  percent: number;
  speedLabel: string;
  etaLabel: string;
  sizeLabel: string;
  stage: DownloadStage;
};

const DONE_FLASH_MS = 800;

const INITIAL_STATE: DownloadProgressState = {
  active: false,
  percent: 0,
  speedLabel: '',
  etaLabel: '',
  sizeLabel: '',
  stage: 'waiting',
};

/**
 * Subscribes to yt-dlp progress events, parses each line into structured state,
 * and self-clears 800 ms after the download completes (to allow a brief 100% flash).
 */
export function useDownloadProgress(): {
  progress: DownloadProgressState;
  clear: () => void;
} {
  const [progress, setProgress] = useState<DownloadProgressState>(INITIAL_STATE);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const clearFlashTimer = () => {
    if (flashTimerRef.current !== undefined) {
      clearTimeout(flashTimerRef.current);
      flashTimerRef.current = undefined;
    }
  };

  const clear = useCallback(() => {
    clearFlashTimer();
    setProgress(INITIAL_STATE);
  }, []);

  useEffect(() => {
    const api = window.maxframeApi;
    if (!api || typeof api.subscribeDownloadProgress !== 'function') {
      return undefined;
    }

    return api.subscribeDownloadProgress(({ line }) => {
      const event = parseYtdlpProgressLine(line);
      if (!event) return;

      setProgress({
        active: true,
        percent: event.percent,
        speedLabel: event.speedLabel,
        etaLabel: event.etaLabel,
        sizeLabel: event.sizeLabel,
        stage: event.stage,
      });

      if (event.stage === 'done') {
        clearFlashTimer();
        flashTimerRef.current = setTimeout(() => {
          setProgress(INITIAL_STATE);
        }, DONE_FLASH_MS);
      }
    });
  }, []);

  useEffect(() => {
    return () => {
      clearFlashTimer();
    };
  }, []);

  return { progress, clear };
}
