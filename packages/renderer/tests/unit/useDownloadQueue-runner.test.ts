import {
  applyParsedProgress,
  createEmptyQueueModel,
  enqueueJobs,
  markJobCancelled,
  markJobComplete,
  markJobFailed,
  setActiveJobId,
  setDownloadStarted,
  setJobAnalysis,
  setJobFormatChoice,
} from '@src/domain/download-queue/model.js';
import type { YtdlpProgressEvent } from '@src/domain/progress/parseYtdlpProgressLine.js';
import { queueReducer, type QueueAction } from '@ui/hooks/useDownloadQueue';
import { describe, expect, it } from 'vitest';

function run(state: ReturnType<typeof createEmptyQueueModel>, action: QueueAction) {
  return queueReducer(state, action);
}

describe('useDownloadQueue runner actions', () => {
  it('setActiveJob updates activeJobId', () => {
    const m0 = enqueueJobs(createEmptyQueueModel(), [{ id: 'j1', url: 'a' }]);
    const m1 = run(m0, { type: 'setActiveJob', id: 'j1' });
    expect(m1.activeJobId).toBe('j1');
    const m2 = run(m1, { type: 'setActiveJob', id: null });
    expect(m2.activeJobId).toBe(null);
  });

  it('setAnalysis stores snapshot on job', () => {
    const m0 = enqueueJobs(createEmptyQueueModel(), [{ id: 'j1', url: 'a' }]);
    const m1 = run(m0, {
      type: 'setAnalysis',
      jobId: 'j1',
      analysis: { url: 'a', title: 'T', uploader: 'U' },
    });
    expect(m1.jobs[0]?.analysis?.title).toBe('T');
    expect(m1.jobs[0]?.analysis?.uploader).toBe('U');
  });

  it('setFormat stores formatChoice', () => {
    const m0 = enqueueJobs(createEmptyQueueModel(), [{ id: 'j1', url: 'a' }]);
    const m1 = run(m0, {
      type: 'setFormat',
      jobId: 'j1',
      choice: { formatId: '137', hasAudio: false },
    });
    expect(m1.jobs[0]?.formatChoice?.formatId).toBe('137');
  });

  it('setDownloadStarted marks downloadStarted', () => {
    const m0 = enqueueJobs(createEmptyQueueModel(), [{ id: 'j1', url: 'a' }]);
    const m1 = run(m0, { type: 'setDownloadStarted', jobId: 'j1', started: true });
    expect(m1.jobs[0]?.downloadStarted).toBe(true);
  });

  it('applyProgress updates active job progress', () => {
    let m = enqueueJobs(createEmptyQueueModel(), [{ id: 'j1', url: 'a' }]);
    m = setActiveJobId(m, 'j1');
    const event: YtdlpProgressEvent = {
      percent: 42,
      speedLabel: '1MiB/s',
      etaLabel: '00:10',
      sizeLabel: '10MiB',
      stage: 'downloading',
    };
    const m1 = run(m, { type: 'applyProgress', jobId: 'j1', event });
    expect(m1.jobs[0]?.progress.percent).toBe(42);
  });

  it('completeJob moves job to history', () => {
    const m0 = enqueueJobs(createEmptyQueueModel(), [{ id: 'j1', url: 'a' }]);
    const m1 = run(m0, {
      type: 'completeJob',
      jobId: 'j1',
      outputPath: 'C:\\out.mp4',
    });
    expect(m1.jobs).toHaveLength(0);
    expect(m1.historyJobs[0]?.terminal).toBe('complete');
    expect(m1.historyJobs[0]?.outputPath).toBe('C:\\out.mp4');
  });

  it('failJob moves job to history as failed', () => {
    const m0 = enqueueJobs(createEmptyQueueModel(), [{ id: 'j1', url: 'a' }]);
    const m1 = run(m0, {
      type: 'failJob',
      jobId: 'j1',
      status: 'Analyze failed',
      detail: 'network',
    });
    expect(m1.historyJobs[0]?.terminal).toBe('failed');
    expect(m1.historyJobs[0]?.status).toBe('Analyze failed');
  });

  it('cancelJob moves job to history as cancelled', () => {
    const m0 = enqueueJobs(createEmptyQueueModel(), [{ id: 'j1', url: 'a' }]);
    const m1 = run(m0, { type: 'cancelJob', jobId: 'j1' });
    expect(m1.historyJobs[0]?.terminal).toBe('cancelled');
  });
});
