import { selectNextAction } from '@src/domain/download-queue/model.js';
import { parseYtdlpProgressLine } from '@src/domain/progress/parseYtdlpProgressLine.js';
import { useCallback, useEffect, useRef, useState, type Dispatch } from 'react';

import {
  getLastOutputFolder,
  parentFolderFromFilePath,
  setLastOutputFolder,
  type OutputMode,
} from '../lib/appPreferences.js';
import { buildSuggestedFileName } from '../lib/buildSuggestedFileName.js';
import { resolveBestDownload } from '../lib/resolveBestDownload.js';
import type { QueueJob, QueueModel } from '@src/domain/download-queue/model.js';
import type { QueueAction } from './useDownloadQueue.js';

type UseQueueRunnerOptions = {
  model: QueueModel;
  dispatch: Dispatch<QueueAction>;
  outputMode: OutputMode;
  downloadBusy: boolean;
};

export function useQueueRunner({
  model,
  dispatch,
  outputMode,
  downloadBusy,
}: UseQueueRunnerOptions): {
  running: boolean;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  error: string | undefined;
} {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const processingRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const outputDirRef = useRef<string | undefined>(getLastOutputFolder());

  const runAnalyzeStep = useCallback(
    async (jobId: string, url: string) => {
      dispatch({ type: 'setActiveJob', id: jobId });
      try {
        const result = await window.maxframeApi.analyzeVideoUrl(url);
        if (stopRequestedRef.current) {
          dispatch({ type: 'cancelJob', jobId });
          return;
        }
        dispatch({
          type: 'setAnalysis',
          jobId,
          analysis: {
            url: result.url,
            title: result.title,
            videoId: result.videoId,
            uploader: result.uploader,
          },
        });
        const best = resolveBestDownload(result, outputMode);
        if (!best) {
          dispatch({
            type: 'failJob',
            jobId,
            status: 'No suitable format',
            detail: `Could not resolve best ${outputMode} quality`,
          });
          return;
        }
        dispatch({
          type: 'setFormat',
          jobId,
          choice: { formatId: best.formatId, hasAudio: best.hasAudio },
        });
      } catch (caught) {
        const msg =
          caught instanceof Error ? caught.message : 'Analyze failed';
        dispatch({
          type: 'failJob',
          jobId,
          status: 'Analyze failed',
          detail: msg,
        });
      } finally {
        dispatch({ type: 'setActiveJob', id: null });
      }
    },
    [dispatch, outputMode],
  );

  const runDownloadStep = useCallback(
    async (job: QueueJob) => {
      const jobId = job.id;
      if (!job.formatChoice || !job.analysis) {
        return;
      }

      const outputDir = outputDirRef.current;
      if (!outputDir) {
        dispatch({
          type: 'failJob',
          jobId,
          status: 'No output folder',
          detail: 'Pick an output folder before starting the queue',
        });
        return;
      }

      dispatch({ type: 'setActiveJob', id: jobId });
      dispatch({ type: 'setDownloadStarted', jobId, started: true });

      const unsubscribe = window.maxframeApi.subscribeDownloadProgress(
        ({ line }) => {
          const event = parseYtdlpProgressLine(line);
          if (!event) return;
          dispatch({ type: 'applyProgress', jobId, event });
        },
      );

      try {
        const suggestedFileName = buildSuggestedFileName({
          title: job.analysis.title,
          videoId: job.analysis.videoId,
          uploader: job.analysis.uploader,
          outputMode,
        });
        const { outputPath } = await window.maxframeApi.downloadVideo({
          url: job.analysis.url,
          formatId: job.formatChoice.formatId,
          hasAudio: job.formatChoice.hasAudio,
          suggestedFileName,
          outputMode,
          outputDir,
        });
        if (stopRequestedRef.current) {
          return;
        }
        setLastOutputFolder(parentFolderFromFilePath(outputPath));
        outputDirRef.current = parentFolderFromFilePath(outputPath);
        dispatch({ type: 'completeJob', jobId, outputPath });
      } catch (caught) {
        const msg =
          caught instanceof Error ? caught.message : 'Download failed';
        if (msg === 'Download canceled.' || stopRequestedRef.current) {
          dispatch({ type: 'cancelJob', jobId });
        } else {
          dispatch({
            type: 'failJob',
            jobId,
            status: 'Download failed',
            detail: msg,
          });
        }
      } finally {
        unsubscribe();
        dispatch({ type: 'setActiveJob', id: null });
      }
    },
    [dispatch, outputMode],
  );

  useEffect(() => {
    if (!running || processingRef.current) return;

    const next = selectNextAction(model);
    if (!next) {
      if (model.jobs.length === 0) {
        setRunning(false);
      }
      return;
    }

    processingRef.current = true;
    void (async () => {
      try {
        if (next.action === 'analyze') {
          await runAnalyzeStep(next.job.id, next.job.submittedUrl);
        } else {
          await runDownloadStep(next.job);
        }
      } finally {
        processingRef.current = false;
      }
    })();
  }, [running, model, runAnalyzeStep, runDownloadStep]);

  const start = useCallback(async () => {
    if (downloadBusy || running || model.jobs.length === 0) {
      return;
    }

    if (!outputDirRef.current) {
      const picked = await window.maxframeApi.pickOutputFolder();
      if (picked.canceled) {
        return;
      }
      outputDirRef.current = picked.folderPath;
      setLastOutputFolder(picked.folderPath);
    }

    stopRequestedRef.current = false;
    setError(undefined);
    setRunning(true);
  }, [downloadBusy, model.jobs.length, running]);

  const stop = useCallback(async () => {
    stopRequestedRef.current = true;
    const activeId = model.activeJobId;
    if (activeId) {
      const job = model.jobs.find((j) => j.id === activeId);
      if (job?.downloadStarted) {
        try {
          await window.maxframeApi.cancelDownload();
        } catch {
          /* ignore */
        }
      } else {
        dispatch({ type: 'cancelJob', jobId: activeId });
        dispatch({ type: 'setActiveJob', id: null });
      }
    }
    setRunning(false);
  }, [dispatch, model.activeJobId, model.jobs]);

  return { running, start, stop, error };
}
