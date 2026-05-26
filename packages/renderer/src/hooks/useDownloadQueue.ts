import { useCallback, useMemo, useReducer } from 'react';

import {
  canReorderJob,
  createEmptyQueueModel,
  enqueueJobs,
  moveJob,
  removeJob,
  summarizeQueue,
  type QueueModel,
} from '@src/domain/download-queue/model.js';

export type QueueAction =
  | { type: 'enqueue'; entries: { id: string; url: string }[] }
  | { type: 'move'; id: string; direction: 'up' | 'down' }
  | { type: 'remove'; id: string };

function queueReducer(state: QueueModel, action: QueueAction): QueueModel {
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
    enqueueBulkText,
    moveJobInQueue,
    removeJobFromQueue,
  };
}
