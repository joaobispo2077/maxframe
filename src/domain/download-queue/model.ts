import type {
  DownloadStage,
  YtdlpProgressEvent,
} from '@src/domain/progress/parseYtdlpProgressLine.js';

export type QueuePhase = 'pre' | 'download' | 'post' | 'terminal';

/** Narrow snapshot for queue row title + format UX — mirrors analyze IPC fields needed by UI. */
export type VideoAnalysisSnapshot = {
  url: string;
  title?: string;
  videoId?: string;
};

export type QueueJob = {
  id: string;
  orderIndex: number;
  submittedUrl: string;
  createdAt: number;
  analysis?: VideoAnalysisSnapshot;
  formatChoice?: { formatId: string; hasAudio: boolean };
  /** Runner sets true after `downloadVideo` invoked for this job. */
  downloadStarted?: boolean;
  phase: QueuePhase;
  status: string;
  statusDetail?: string;
  progress: {
    percent: number;
    speedLabel: string;
    etaLabel: string;
    sizeLabel: string;
    stage: DownloadStage;
  };
  terminal?: 'complete' | 'failed' | 'cancelled';
  finishedAt?: number;
  outputPath?: string;
};

export type QueueModel = {
  jobs: QueueJob[];
  /** Terminal jobs only; FIFO trim from front when over cap. */
  historyJobs: QueueJob[];
  activeJobId: string | null;
};

export type SummaryCounts = {
  pendingAnalyze: number;
  awaitingFormat: number;
  queuedReady: number;
  downloading: number;
  postProcessing: number;
  historyComplete: number;
  historyFailed: number;
  historyCancelled: number;
};

export type NextRunnable =
  | { action: 'analyze'; job: QueueJob }
  | { action: 'download'; job: QueueJob };

const HISTORY_CAP = 50;

function initialProgress(): QueueJob['progress'] {
  return {
    percent: 0,
    speedLabel: '',
    etaLabel: '',
    sizeLabel: '',
    stage: 'waiting',
  };
}

export function createEmptyQueueModel(): QueueModel {
  return { jobs: [], historyJobs: [], activeJobId: null };
}

export function enqueueJobs(
  model: QueueModel,
  entries: ReadonlyArray<{ id: string; url: string }>,
): QueueModel {
  const baseIndex =
    model.jobs.length === 0
      ? 0
      : Math.max(...model.jobs.map((j) => j.orderIndex)) + 1;
  const newJobs: QueueJob[] = entries.map((e, i) => ({
    id: e.id,
    orderIndex: baseIndex + i,
    submittedUrl: e.url,
    createdAt: Date.now(),
    phase: 'pre',
    status: 'Pending',
    progress: initialProgress(),
  }));
  return {
    ...model,
    jobs: [...model.jobs, ...newJobs],
  };
}

function normalizeOrderIndices(jobs: QueueJob[]): QueueJob[] {
  const sorted = [...jobs].sort((a, b) => a.orderIndex - b.orderIndex);
  return sorted.map((j, idx) => ({ ...j, orderIndex: idx }));
}

export function removeJob(model: QueueModel, id: string): QueueModel {
  const jobs = model.jobs.filter((j) => j.id !== id);
  return {
    ...model,
    jobs: normalizeOrderIndices(jobs),
  };
}

function sortJobs(jobs: QueueJob[]): QueueJob[] {
  return [...jobs].sort((a, b) => a.orderIndex - b.orderIndex);
}

export function moveJob(
  model: QueueModel,
  id: string,
  direction: 'up' | 'down',
): QueueModel {
  const sorted = sortJobs(model.jobs);
  const idx = sorted.findIndex((j) => j.id === id);
  if (idx === -1) return model;
  const swapWith = direction === 'up' ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= sorted.length) return model;
  const a = sorted[idx]!;
  const b = sorted[swapWith]!;
  const swapped = sorted.map((j) => {
    if (j.id === a.id) return { ...j, orderIndex: b.orderIndex };
    if (j.id === b.id) return { ...j, orderIndex: a.orderIndex };
    return j;
  });
  return {
    ...model,
    jobs: normalizeOrderIndices(swapped),
  };
}

export function canReorderJob(
  model: QueueModel,
  id: string,
  direction: 'up' | 'down',
): boolean {
  const job = model.jobs.find((j) => j.id === id);
  if (!job) return false;
  if (model.activeJobId === id) return false;
  if (job.phase === 'download' || job.phase === 'post') return false;

  const sorted = sortJobs(model.jobs);
  const idx = sorted.findIndex((j) => j.id === id);
  if (idx === -1) return false;
  const neighbor = direction === 'up' ? idx - 1 : idx + 1;
  return neighbor >= 0 && neighbor < sorted.length;
}

export function trimHistoryJobs(jobs: QueueJob[], maxLen: number): QueueJob[] {
  if (jobs.length <= maxLen) return jobs;
  return jobs.slice(jobs.length - maxLen);
}

export function summarizeQueue(model: QueueModel): SummaryCounts {
  let pendingAnalyze = 0;
  let awaitingFormat = 0;
  let queuedReady = 0;
  let downloading = 0;
  let postProcessing = 0;

  for (const j of model.jobs) {
    if (!j.analysis) pendingAnalyze += 1;
    else if (!j.formatChoice) awaitingFormat += 1;
    else if (!j.downloadStarted) queuedReady += 1;

    if (model.activeJobId === j.id) {
      if (j.phase === 'download') downloading += 1;
      if (j.phase === 'post') postProcessing += 1;
    }
  }

  let historyComplete = 0;
  let historyFailed = 0;
  let historyCancelled = 0;
  for (const h of model.historyJobs) {
    if (h.terminal === 'complete') historyComplete += 1;
    else if (h.terminal === 'failed') historyFailed += 1;
    else if (h.terminal === 'cancelled') historyCancelled += 1;
  }

  return {
    pendingAnalyze,
    awaitingFormat,
    queuedReady,
    downloading,
    postProcessing,
    historyComplete,
    historyFailed,
    historyCancelled,
  };
}

function progressPhaseFromEvent(event: YtdlpProgressEvent): QueuePhase {
  if (event.stage === 'downloading' || event.stage === 'waiting') {
    return 'download';
  }
  if (event.stage === 'merging' || event.stage === 'extracting-audio') {
    return 'post';
  }
  return 'download';
}

export function applyParsedProgress(
  model: QueueModel,
  targetJobId: string,
  event: YtdlpProgressEvent,
): QueueModel {
  if (model.activeJobId !== targetJobId) return model;
  const jobs = model.jobs.map((j) => {
    if (j.id !== targetJobId) return j;
    return {
      ...j,
      phase: progressPhaseFromEvent(event),
      progress: {
        percent: event.percent,
        speedLabel: event.speedLabel,
        etaLabel: event.etaLabel,
        sizeLabel: event.sizeLabel,
        stage: event.stage,
      },
    };
  });
  return { ...model, jobs };
}

export function setActiveJobId(
  model: QueueModel,
  id: string | null,
): QueueModel {
  return { ...model, activeJobId: id };
}

export function setJobAnalysis(
  model: QueueModel,
  jobId: string,
  analysis: VideoAnalysisSnapshot,
): QueueModel {
  const jobs = model.jobs.map((j) =>
    j.id === jobId ? { ...j, analysis, status: 'Ready to choose format' } : j,
  );
  return { ...model, jobs };
}

export function setJobFormatChoice(
  model: QueueModel,
  jobId: string,
  choice: { formatId: string; hasAudio: boolean },
): QueueModel {
  const jobs = model.jobs.map((j) =>
    j.id === jobId
      ? { ...j, formatChoice: choice, status: 'Queued for download' }
      : j,
  );
  return { ...model, jobs };
}

export function setDownloadStarted(
  model: QueueModel,
  jobId: string,
  started: boolean,
): QueueModel {
  const jobs = model.jobs.map((j) =>
    j.id === jobId ? { ...j, downloadStarted: started } : j,
  );
  return { ...model, jobs };
}

function promoteToHistory(model: QueueModel, job: QueueJob): QueueModel {
  const terminalJob: QueueJob = {
    ...job,
    phase: 'terminal',
    finishedAt: Date.now(),
  };
  let historyJobs = [...model.historyJobs, terminalJob];
  historyJobs = trimHistoryJobs(historyJobs, HISTORY_CAP);
  return {
    ...model,
    jobs: normalizeOrderIndices(model.jobs.filter((j) => j.id !== job.id)),
    historyJobs,
    activeJobId: model.activeJobId === job.id ? null : model.activeJobId,
  };
}

export function markJobComplete(
  model: QueueModel,
  jobId: string,
  outputPath?: string,
): QueueModel {
  const job = model.jobs.find((j) => j.id === jobId);
  if (!job) return model;
  const updated: QueueJob = {
    ...job,
    terminal: 'complete',
    status: 'Complete',
    outputPath,
  };
  return promoteToHistory(model, updated);
}

export function markJobFailed(
  model: QueueModel,
  jobId: string,
  status: string,
  detail?: string,
): QueueModel {
  const job = model.jobs.find((j) => j.id === jobId);
  if (!job) return model;
  const updated: QueueJob = {
    ...job,
    terminal: 'failed',
    status,
    statusDetail: detail,
  };
  return promoteToHistory(model, updated);
}

export function markJobCancelled(model: QueueModel, jobId: string): QueueModel {
  const job = model.jobs.find((j) => j.id === jobId);
  if (!job) return model;
  const updated: QueueJob = {
    ...job,
    terminal: 'cancelled',
    status: 'Cancelled',
  };
  return promoteToHistory(model, updated);
}

export function selectNextAction(model: QueueModel): NextRunnable | null {
  if (model.activeJobId !== null) return null;
  const sorted = sortJobs(model.jobs);
  for (const j of sorted) {
    if (!j.analysis) return { action: 'analyze', job: j };
  }
  for (const j of sorted) {
    if (j.analysis && !j.formatChoice) return null;
  }
  for (const j of sorted) {
    if (j.analysis && j.formatChoice && !j.downloadStarted) {
      return { action: 'download', job: j };
    }
  }
  return null;
}
