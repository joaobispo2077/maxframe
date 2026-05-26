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
  selectNextAction,
  setActiveJobId,
  setDownloadStarted,
  setJobAnalysis,
  setJobFormatChoice,
  summarizeQueue,
  trimHistoryJobs,
  type QueueJob,
} from '@src/domain/download-queue/model.js';
import type { YtdlpProgressEvent } from '@src/domain/progress/parseYtdlpProgressLine.js';

function sampleProgress(): QueueJob['progress'] {
  return {
    percent: 0,
    speedLabel: '',
    etaLabel: '',
    sizeLabel: '',
    stage: 'waiting',
  };
}

describe('downloadQueueModel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('enqueueJobs assigns contiguous orderIndex and unique ids', () => {
    let n = 0;
    const ids = () => `id-${++n}`;
    const m0 = createEmptyQueueModel();
    const m1 = enqueueJobs(m0, [{ url: 'https://a.test', id: ids() }]);
    const m2 = enqueueJobs(m1, [
      { url: 'https://b.test', id: ids() },
      { url: 'https://c.test', id: ids() },
    ]);
    expect(m2.jobs).toHaveLength(3);
    expect(m2.jobs.map((j) => j.orderIndex)).toEqual([0, 1, 2]);
    expect(m2.jobs.map((j) => j.submittedUrl)).toEqual([
      'https://a.test',
      'https://b.test',
      'https://c.test',
    ]);
    expect(new Set(m2.jobs.map((j) => j.id)).size).toBe(3);
  });

  it('removeJob drops middle job and compacts orderIndex', () => {
    let i = 0;
    const ids = () => `x-${++i}`;
    const m = enqueueJobs(createEmptyQueueModel(), [
      { url: 'a', id: ids() },
      { url: 'b', id: ids() },
      { url: 'c', id: ids() },
    ]);
    const midId = m.jobs[1]!.id;
    const out = removeJob(m, midId);
    expect(out.jobs).toHaveLength(2);
    expect(out.jobs.map((j) => j.orderIndex)).toEqual([0, 1]);
    expect(out.jobs.map((j) => j.submittedUrl)).toEqual(['a', 'c']);
  });

  it('moveJob swaps order with neighbor down', () => {
    let i = 0;
    const ids = () => `m-${++i}`;
    const m = enqueueJobs(createEmptyQueueModel(), [
      { url: 'a', id: ids() },
      { url: 'b', id: ids() },
    ]);
    const idA = m.jobs[0]!.id;
    const out = moveJob(m, idA, 'down');
    expect(out.jobs.map((j) => j.submittedUrl)).toEqual(['b', 'a']);
    expect(out.jobs.map((j) => j.orderIndex)).toEqual([0, 1]);
  });

  it('moveJob no-op when moving top job up', () => {
    let i = 0;
    const ids = () => `u-${++i}`;
    const m = enqueueJobs(createEmptyQueueModel(), [
      { url: 'a', id: ids() },
      { url: 'b', id: ids() },
    ]);
    const idA = m.jobs[0]!.id;
    const out = moveJob(m, idA, 'up');
    expect(out.jobs.map((j) => j.submittedUrl)).toEqual(['a', 'b']);
    expect(out).toBe(m);
  });

  it('canReorderJob is false for unknown id', () => {
    const m = enqueueJobs(createEmptyQueueModel(), [{ url: 'a', id: 'only' }]);
    expect(canReorderJob(m, 'missing', 'up')).toBe(false);
  });

  it('canReorderJob is false when job id matches activeJobId', () => {
    let i = 0;
    const ids = () => `act-${++i}`;
    const m0 = enqueueJobs(createEmptyQueueModel(), [{ url: 'a', id: ids() }]);
    const id = m0.jobs[0]!.id;
    const m = setActiveJobId(m0, id);
    expect(canReorderJob(m, id, 'down')).toBe(false);
  });

  it('canReorderJob is false when job phase is download', () => {
    let i = 0;
    const ids = () => `dl-${++i}`;
    const m0 = enqueueJobs(createEmptyQueueModel(), [{ url: 'a', id: ids() }]);
    const id = m0.jobs[0]!.id;
    const job = m0.jobs[0]!;
    const m: typeof m0 = {
      ...m0,
      jobs: [{ ...job, phase: 'download' }],
    };
    expect(canReorderJob(m, id, 'down')).toBe(false);
  });

  it('trimHistoryJobs drops oldest past max', () => {
    const history: QueueJob[] = Array.from({ length: 3 }, (_, i) => ({
      id: `h-${i}`,
      orderIndex: i,
      submittedUrl: `u${i}`,
      createdAt: i,
      phase: 'terminal' as const,
      status: 'Done',
      progress: sampleProgress(),
      terminal: 'complete' as const,
      finishedAt: 100 + i,
    }));
    const trimmed = trimHistoryJobs(history, 2);
    expect(trimmed).toHaveLength(2);
    expect(trimmed.map((j) => j.id)).toEqual(['h-1', 'h-2']);
  });

  it('summarizeQueue counts pending analyze and awaiting format', () => {
    let i = 0;
    const ids = () => `s-${++i}`;
    const base = enqueueJobs(createEmptyQueueModel(), [
      { url: 'a', id: ids() },
      { url: 'b', id: ids() },
    ]);
    const j0 = base.jobs[0]!;
    const j1 = base.jobs[1]!;
    const analyzed = setJobAnalysis(base, j1.id, {
      url: j1.submittedUrl,
      title: 'T',
    });
    const s = summarizeQueue(analyzed);
    expect(s.pendingAnalyze).toBe(1);
    expect(s.awaitingFormat).toBe(1);
  });

  it('applyParsedProgress updates only activeJobId match', () => {
    let i = 0;
    const ids = () => `p-${++i}`;
    const m0 = enqueueJobs(createEmptyQueueModel(), [
      { url: 'a', id: ids() },
      { url: 'b', id: ids() },
    ]);
    const activeId = m0.jobs[0]!.id;
    const m1 = setActiveJobId(m0, activeId);
    const ev: YtdlpProgressEvent = {
      percent: 42,
      speedLabel: '2MiB/s',
      etaLabel: '00:10',
      sizeLabel: '10MiB',
      stage: 'downloading',
    };
    const out = applyParsedProgress(m1, activeId, ev);
    expect(out.jobs[0]!.progress.percent).toBe(42);
    expect(out.jobs[0]!.phase).toBe('download');
    expect(out.jobs[1]!.progress.percent).toBe(0);
  });

  it('applyParsedProgress no-op when target id mismatches activeJobId', () => {
    let i = 0;
    const ids = () => `pm-${++i}`;
    const m0 = enqueueJobs(createEmptyQueueModel(), [{ url: 'a', id: ids() }]);
    const id = m0.jobs[0]!.id;
    const m1 = setActiveJobId(m0, id);
    const ev: YtdlpProgressEvent = {
      percent: 99,
      speedLabel: '',
      etaLabel: '',
      sizeLabel: '',
      stage: 'downloading',
    };
    const out = applyParsedProgress(m1, 'other-id', ev);
    expect(out.jobs[0]!.progress.percent).toBe(0);
    expect(out).toBe(m1);
  });

  it('applyParsedProgress maps merging stage to post phase', () => {
    let i = 0;
    const ids = () => `mg-${++i}`;
    const m0 = enqueueJobs(createEmptyQueueModel(), [{ url: 'a', id: ids() }]);
    const id = m0.jobs[0]!.id;
    const m1 = setActiveJobId(m0, id);
    const ev: YtdlpProgressEvent = {
      percent: 10,
      speedLabel: '',
      etaLabel: '',
      sizeLabel: 'merging',
      stage: 'merging',
    };
    const out = applyParsedProgress(m1, id, ev);
    expect(out.jobs[0]!.phase).toBe('post');
  });

  it('markJobComplete moves job to history and clears activeJobId when matched', () => {
    let i = 0;
    const ids = () => `mc-${++i}`;
    const m0 = enqueueJobs(createEmptyQueueModel(), [{ url: 'a', id: ids() }]);
    const id = m0.jobs[0]!.id;
    const m1 = setActiveJobId(m0, id);
    const m2 = markJobComplete(m1, id, '/out/x.mp4');
    expect(m2.jobs).toHaveLength(0);
    expect(m2.historyJobs).toHaveLength(1);
    expect(m2.historyJobs[0]!.terminal).toBe('complete');
    expect(m2.historyJobs[0]!.outputPath).toBe('/out/x.mp4');
    expect(m2.activeJobId).toBe(null);
  });

  it('markJobFailed sets statusDetail and promotes to history', () => {
    let i = 0;
    const ids = () => `mf-${++i}`;
    const m0 = enqueueJobs(createEmptyQueueModel(), [{ url: 'a', id: ids() }]);
    const id = m0.jobs[0]!.id;
    const m1 = markJobFailed(m0, id, 'Merge failed', 'ffmpeg exit 1');
    expect(m1.jobs).toHaveLength(0);
    expect(m1.historyJobs[0]!.terminal).toBe('failed');
    expect(m1.historyJobs[0]!.status).toBe('Merge failed');
    expect(m1.historyJobs[0]!.statusDetail).toBe('ffmpeg exit 1');
  });

  it('markJobCancelled promotes to history', () => {
    let i = 0;
    const ids = () => `mcn-${++i}`;
    const m0 = enqueueJobs(createEmptyQueueModel(), [{ url: 'a', id: ids() }]);
    const id = m0.jobs[0]!.id;
    const m1 = markJobCancelled(m0, id);
    expect(m1.historyJobs[0]!.terminal).toBe('cancelled');
  });

  it('selectNextAction returns analyze for first job without analysis when idle', () => {
    let i = 0;
    const ids = () => `sn-${++i}`;
    const m = enqueueJobs(createEmptyQueueModel(), [
      { url: 'a', id: ids() },
      { url: 'b', id: ids() },
    ]);
    const next = selectNextAction(m);
    expect(next?.action).toBe('analyze');
    expect(next?.job.submittedUrl).toBe('a');
  });

  it('selectNextAction returns null when activeJobId set', () => {
    let i = 0;
    const ids = () => `busy-${++i}`;
    const m0 = enqueueJobs(createEmptyQueueModel(), [{ url: 'a', id: ids() }]);
    const id = m0.jobs[0]!.id;
    const m = setActiveJobId(m0, id);
    expect(selectNextAction(m)).toBe(null);
  });

  it('selectNextAction returns null when head job awaits format', () => {
    let i = 0;
    const ids = () => `fmt-${++i}`;
    const m0 = enqueueJobs(createEmptyQueueModel(), [
      { url: 'a', id: ids() },
      { url: 'b', id: ids() },
    ]);
    const idA = m0.jobs[0]!.id;
    const idB = m0.jobs[1]!.id;
    const analyzedBoth = setJobAnalysis(setJobAnalysis(m0, idA, { url: 'a' }), idB, {
      url: 'b',
    });
    expect(selectNextAction(analyzedBoth)).toBe(null);
  });

  it('selectNextAction returns download for first ready job with formatChoice', () => {
    let i = 0;
    const ids = () => `dl2-${++i}`;
    const m0 = enqueueJobs(createEmptyQueueModel(), [{ url: 'a', id: ids() }]);
    const id = m0.jobs[0]!.id;
    const withAnalysis = setJobAnalysis(m0, id, { url: 'a', title: 'T' });
    const ready = setJobFormatChoice(withAnalysis, id, {
      formatId: '299',
      hasAudio: false,
    });
    const next = selectNextAction(ready);
    expect(next?.action).toBe('download');
    expect(next?.job.id).toBe(id);
  });

  it('selectNextAction skips download when downloadStarted true', () => {
    let i = 0;
    const ids = () => `ds-${++i}`;
    const m0 = enqueueJobs(createEmptyQueueModel(), [{ url: 'a', id: ids() }]);
    const id = m0.jobs[0]!.id;
    let m = setJobAnalysis(m0, id, { url: 'a' });
    m = setJobFormatChoice(m, id, { formatId: '299', hasAudio: false });
    m = setDownloadStarted(m, id, true);
    expect(selectNextAction(m)).toBe(null);
  });

  it('markComplete trims history past HISTORY_CAP', () => {
    let i = 0;
    const empty = createEmptyQueueModel();
    let m = empty;
    for (let k = 0; k < 52; k++) {
      const id = `h-${k}`;
      m = enqueueJobs(m, [{ url: `u-${k}`, id }]);
      const jid = m.jobs[0]!.id;
      m = markJobComplete(m, jid);
    }
    expect(m.historyJobs.length).toBeLessThanOrEqual(50);
  });
});
