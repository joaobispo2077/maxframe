import { useCallback, useMemo, useReducer, type Dispatch } from 'react';

import type { YtdlpProgressEvent } from '@src/domain/progress/parseYtdlpProgressLine.js';
import {
  applyParsedProgress,
  canReorderJob,
  createEmptyQueueModel,
  enqueueJobs,
  markJobCancelled,
  markJobComplete,
  markJobFailed,
  moveJob,
  removeJob,
  setActiveJobId,
  setDownloadStarted,
  setJobAnalysis,
  setJobFormatChoice,
  summarizeQueue,
  type QueueModel,
  type VideoAnalysisSnapshot,
} from '@src/domain/download-queue/model.js';

export type QueueAction =
  | { type: 'enqueue'; entries: { id: string; url: string }[] }
  | { type: 'move'; id: string; direction: 'up' | 'down' }
  | { type: 'remove'; id: string }
  | { type: 'setActiveJob'; id: string | null }
  | {
      type: 'setAnalysis';
      jobId: string;
      analysis: VideoAnalysisSnapshot;
    }
  | {
      type: 'setFormat';
      jobId: string;
      choice: { formatId: string; hasAudio: boolean };
    }
  | { type: 'setDownloadStarted'; jobId: string; started: boolean }
  | {
      type: 'applyProgress';
      jobId: string;
      event: YtdlpProgressEvent;
    }
  | { type: 'completeJob'; jobId: string; outputPath?: string }
  | { type: 'failJob'; jobId: string; status: string; detail?: string }
  | { type: 'cancelJob'; jobId: string };

export function queueReducer(state: QueueModel, action: QueueAction): QueueModel {
  switch (action.type) {
    case 'enqueue':
      return enqueueJobs(state, action.entries);
    case 'move':
      if (!canReorderJob(state, action.id, action.direction)) {
        return state;
      }
      return moveJob(state, action.id, action.direction);
    case 'remove':
      return removeJob(state, action.id);
    case 'setActiveJob':
      return setActiveJobId(state, action.id);
    case 'setAnalysis':
      return setJobAnalysis(state, action.jobId, action.analysis);
    case 'setFormat':
      return setJobFormatChoice(state, action.jobId, action.choice);
    case 'setDownloadStarted':
      return setDownloadStarted(state, action.jobId, action.started);
    case 'applyProgress':
      return applyParsedProgress(state, action.jobId, action.event);
    case 'completeJob':
      return markJobComplete(state, action.jobId, action.outputPath);
    case 'failJob':
      return markJobFailed(state, action.jobId, action.status, action.detail);
    case 'cancelJob':
      return markJobCancelled(state, action.jobId);
    default:
      return state;
  }
}

function splitUrlsToEntries(blob: string): { id: string; url: string }[] {
  return blob
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((url) => ({ url, id: crypto.randomUUID() }));
}

export function useDownloadQueue(): {
  model: QueueModel;
  summary: ReturnType<typeof summarizeQueue>;
  dispatch: Dispatch<QueueAction>;
  enqueueBulkText: (text: string) => void;
  moveJobInQueue: (id: string, direction: 'up' | 'down') => void;
  removeJobFromQueue: (id: string) => void;
} {
  const [model, dispatch] = useReducer(
    queueReducer,
    undefined,
    createEmptyQueueModel,
  );

  const summary = useMemo(() => summarizeQueue(model), [model]);

  const enqueueBulkText = useCallback((text: string) => {
    const entries = splitUrlsToEntries(text);
    if (entries.length === 0) return;
    dispatch({ type: 'enqueue', entries });
  }, []);

  const moveJobInQueue = useCallback((id: string, direction: 'up' | 'down') => {
    dispatch({ type: 'move', id, direction });
  }, []);

  const removeJobFromQueue = useCallback((id: string) => {
    dispatch({ type: 'remove', id });
  }, []);

  return {
    model,
    summary,
    dispatch,
    enqueueBulkText,
    moveJobInQueue,
    removeJobFromQueue,
  };
}
