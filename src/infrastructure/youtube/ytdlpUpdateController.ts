import type { YtdlpResolution } from './resolveYtdlpExecutable.js';
import type {
  YtdlpCopySource,
  YtdlpUpdatePhase,
  YtdlpUpdateView,
} from '../../domain/ytdlp/ytdlpUpdateView.js';

import {
  compareYtdlpVersions,
  isYtdlpOutdated,
} from '../../domain/ytdlp/compareYtdlpVersions.js';
import { ytdlpLaunchSkipReason } from '../../domain/ytdlp/ytdlpLaunchSkip.js';
import { isOutdatedNoticeHidden } from '../../domain/ytdlp/ytdlpNotNow.js';
import { YTDLP_CURRENT_VERSION_UNKNOWN } from '../../domain/ytdlp/ytdlpUpdateCopy.js';
import { YtdlpUpdateFailure } from '../../domain/ytdlp/YtdlpUpdateFailure.js';
import {
  YTDLP_CHECK_TIMEOUT_MS,
  YTDLP_LAUNCH_CHECK_DISCLOSURE,
  YTDLP_NOT_NOW_SNOOZE,
  YTDLP_OUTDATED_GRACE_DAYS,
  YTDLP_SETTINGS_CHECK_NOW,
  type YtdlpLaunchCheckDisclosure,
  type YtdlpNotNowSnooze,
} from '../../domain/ytdlp/ytdlpUpdatePolicy.js';

type LatestRelease = {
  version: string;
  publishedAt: string;
};

export type YtdlpUpdateControllerDeps = {
  resolve: () => YtdlpResolution;
  fetchLatest: (timeoutMs: number) => Promise<LatestRelease>;
  install: (version: string) => Promise<void>;
  probe: (executable: string) => Promise<string | undefined>;
  log: (reason: string) => void;
  isBusy: () => boolean;
  now?: () => Date;
  env?: NodeJS.ProcessEnv;
  graceDays?: number;
  snooze?: YtdlpNotNowSnooze;
  manualCheckEnabled?: boolean;
  disclosure?: YtdlpLaunchCheckDisclosure;
  timeoutMs?: number;
  loadDismissedLatest?: () => string | undefined;
  saveDismissedLatest?: (version: string) => void;
  onChange?: (view: YtdlpUpdateView) => void;
};

type UpdateState = {
  launchStarted: boolean;
  dismissedThisSession: boolean;
  dismissedLatest: string | undefined;
  phase: YtdlpUpdatePhase;
  version: string | undefined;
  current: string | undefined;
  latest: string | undefined;
  publishedAt: string | undefined;
  bundled: string | undefined;
  source: YtdlpCopySource;
};

export type YtdlpUpdateController = {
  runLaunchCheck: () => Promise<void>;
  startUpdate: () => Promise<YtdlpUpdateView>;
  dismiss: () => YtdlpUpdateView;
  checkNow: () => Promise<YtdlpUpdateView>;
  getView: () => YtdlpUpdateView;
};

export function createYtdlpUpdateController(
  deps: YtdlpUpdateControllerDeps,
): YtdlpUpdateController {
  const state: UpdateState = {
    launchStarted: false,
    dismissedThisSession: false,
    dismissedLatest: deps.loadDismissedLatest?.(),
    phase: 'idle',
    version: undefined,
    current: undefined,
    latest: undefined,
    publishedAt: undefined,
    bundled: undefined,
    source: 'path',
  };

  function emit(): YtdlpUpdateView {
    const view = buildView(deps, state);
    deps.onChange?.(view);
    return view;
  }

  return {
    async runLaunchCheck() {
      if (state.launchStarted) {
        return;
      }
      state.launchStarted = true;
      await captureRuntime(deps, state);
      if (!skipLaunch(deps, state)) {
        await applyLaunchRelease(deps, state);
      }
      emit();
    },
    startUpdate() {
      return startUpdate(deps, state, emit);
    },
    dismiss() {
      return dismissNotice(deps, state, emit);
    },
    checkNow() {
      return checkNow(deps, state, emit);
    },
    getView() {
      return buildView(deps, state);
    },
  };
}

async function captureRuntime(
  deps: YtdlpUpdateControllerDeps,
  state: UpdateState,
): Promise<void> {
  const resolution = deps.resolve();
  state.source = resolution.source;
  state.version =
    resolution.version ?? (await deps.probe(resolution.executable));
  state.current = state.version;
  if (resolution.fallbackBundledVersion) {
    state.phase = 'fallback';
    state.bundled = resolution.fallbackBundledVersion;
  }
}

function skipLaunch(
  deps: YtdlpUpdateControllerDeps,
  state: UpdateState,
): boolean {
  const env = deps.env ?? process.env;
  const reason = ytdlpLaunchSkipReason({
    ytdlpPathEnv: env.YT_DLP_PATH,
    source: state.source,
    e2e: env.MAXFRAME_E2E,
    ciSmoke: env.MAXFRAME_CI_SMOKE,
  });
  if (!reason) {
    return false;
  }
  deps.log(`skipped: ${reason}`);
  return true;
}

async function applyLaunchRelease(
  deps: YtdlpUpdateControllerDeps,
  state: UpdateState,
): Promise<void> {
  const release = await readLatestSilently(deps);
  if (!release) {
    return;
  }
  state.latest = release.version;
  state.publishedAt = release.publishedAt;
  if (!state.version) {
    deps.log('version unknown');
    return;
  }
  if (!launchSaysOutdated(deps, state, release)) {
    return;
  }
  if (noticeHidden(deps, state, release.version)) {
    return;
  }
  if (state.phase !== 'fallback') {
    state.phase = 'outdated';
    state.current = state.version;
  }
}

function launchSaysOutdated(
  deps: YtdlpUpdateControllerDeps,
  state: UpdateState,
  release: LatestRelease,
): boolean {
  if (!state.version) {
    return false;
  }
  return isYtdlpOutdated({
    current: state.version,
    latest: release.version,
    publishedAt: release.publishedAt,
    now: (deps.now ?? (() => new Date()))(),
    graceDays: deps.graceDays ?? YTDLP_OUTDATED_GRACE_DAYS,
  });
}

function noticeHidden(
  deps: YtdlpUpdateControllerDeps,
  state: UpdateState,
  latest: string,
): boolean {
  return isOutdatedNoticeHidden({
    snooze: deps.snooze ?? YTDLP_NOT_NOW_SNOOZE,
    dismissedThisSession: state.dismissedThisSession,
    dismissedLatest: state.dismissedLatest,
    latest,
  });
}

async function readLatestSilently(
  deps: YtdlpUpdateControllerDeps,
): Promise<LatestRelease | undefined> {
  try {
    return await deps.fetchLatest(deps.timeoutMs ?? YTDLP_CHECK_TIMEOUT_MS);
  } catch (error) {
    deps.log(errorText(error));
    return undefined;
  }
}

async function startUpdate(
  deps: YtdlpUpdateControllerDeps,
  state: UpdateState,
  emit: () => YtdlpUpdateView,
): Promise<YtdlpUpdateView> {
  if (state.phase === 'updating' || deps.isBusy()) {
    return buildView(deps, state);
  }
  const resolution = deps.resolve();
  if (resolution.source === 'env' || resolution.source === 'path') {
    return buildView(deps, state);
  }
  const latest = await ensureLatest(deps, state);
  if (!latest) {
    return emit();
  }
  const current = resolution.version ?? state.current ?? state.version;
  const repairing =
    state.phase === 'fallback' || Boolean(resolution.fallbackBundledVersion);
  if (!repairing && !versionIsOlder(current, latest)) {
    state.phase = 'up-to-date';
    state.current = current;
    state.latest = latest;
    return emit();
  }
  return installLatest(deps, state, emit, latest, current);
}

async function ensureLatest(
  deps: YtdlpUpdateControllerDeps,
  state: UpdateState,
): Promise<string | undefined> {
  if (state.latest) {
    return state.latest;
  }
  try {
    const release = await deps.fetchLatest(
      deps.timeoutMs ?? YTDLP_CHECK_TIMEOUT_MS,
    );
    state.latest = release.version;
    state.publishedAt = release.publishedAt;
    return release.version;
  } catch (error) {
    state.phase = 'error-network';
    state.current = state.current ?? YTDLP_CURRENT_VERSION_UNKNOWN;
    deps.log(errorText(error));
    return undefined;
  }
}

async function installLatest(
  deps: YtdlpUpdateControllerDeps,
  state: UpdateState,
  emit: () => YtdlpUpdateView,
  latest: string,
  current: string | undefined,
): Promise<YtdlpUpdateView> {
  state.phase = 'updating';
  state.latest = latest;
  state.current = current;
  emit();
  try {
    await deps.install(latest);
    state.phase = 'success';
    state.version = latest;
    state.current = latest;
  } catch (error) {
    state.phase = failurePhase(error);
    state.current = current ?? YTDLP_CURRENT_VERSION_UNKNOWN;
    deps.log(errorText(error));
  }
  return emit();
}

function versionIsOlder(current: string | undefined, latest: string): boolean {
  if (!current) {
    return true;
  }
  const compared = compareYtdlpVersions(current, latest);
  if (compared === undefined) {
    return true;
  }
  return compared < 0;
}

function dismissNotice(
  deps: YtdlpUpdateControllerDeps,
  state: UpdateState,
  emit: () => YtdlpUpdateView,
): YtdlpUpdateView {
  const snooze = deps.snooze ?? YTDLP_NOT_NOW_SNOOZE;
  state.dismissedThisSession = true;
  if (snooze === 'until-newer' && state.latest) {
    state.dismissedLatest = state.latest;
    deps.saveDismissedLatest?.(state.latest);
  }
  if (state.phase === 'outdated') {
    state.phase = 'idle';
  }
  return emit();
}

async function checkNow(
  deps: YtdlpUpdateControllerDeps,
  state: UpdateState,
  emit: () => YtdlpUpdateView,
): Promise<YtdlpUpdateView> {
  if (manualCheckOff(deps) || deps.isBusy() || state.phase === 'updating') {
    return buildView(deps, state);
  }
  await captureRuntime(deps, state);
  try {
    const release = await deps.fetchLatest(
      deps.timeoutMs ?? YTDLP_CHECK_TIMEOUT_MS,
    );
    rememberManualRelease(deps, state, release);
  } catch (error) {
    state.phase = 'check-failed';
    deps.log(errorText(error));
  }
  return emit();
}

function rememberManualRelease(
  deps: YtdlpUpdateControllerDeps,
  state: UpdateState,
  release: LatestRelease,
): void {
  state.latest = release.version;
  state.publishedAt = release.publishedAt;
  const current = state.version ?? state.current;
  if (!current) {
    state.phase = 'check-failed';
    deps.log('version unknown');
    return;
  }
  state.current = current;
  if (state.phase === 'fallback') {
    return;
  }
  state.phase = launchSaysOutdated(deps, state, release)
    ? 'outdated'
    : 'up-to-date';
}

function manualCheckOff(deps: YtdlpUpdateControllerDeps): boolean {
  return (deps.manualCheckEnabled ?? YTDLP_SETTINGS_CHECK_NOW) === false;
}

function failurePhase(
  error: unknown,
): 'error-network' | 'error-checksum' | 'error-write' {
  if (error instanceof YtdlpUpdateFailure && error.reason === 'checksum') {
    return 'error-checksum';
  }
  if (error instanceof YtdlpUpdateFailure && error.reason === 'write') {
    return 'error-write';
  }
  return 'error-network';
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function buildView(
  deps: YtdlpUpdateControllerDeps,
  state: UpdateState,
): YtdlpUpdateView {
  const resolution = deps.resolve();
  const phase = visiblePhase(state.phase, resolution);
  return {
    version: resolution.version ?? state.version,
    source: resolution.source,
    phase,
    current: state.current ?? resolution.version ?? state.version,
    latest: state.latest,
    bundled: state.bundled ?? resolution.fallbackBundledVersion,
    manualCheckEnabled: deps.manualCheckEnabled ?? YTDLP_SETTINGS_CHECK_NOW,
    showLaunchDisclosure:
      (deps.disclosure ?? YTDLP_LAUNCH_CHECK_DISCLOSURE) === 'settings-line',
    updateAllowed: !deps.isBusy() && phase !== 'updating',
  };
}

function visiblePhase(
  phase: YtdlpUpdatePhase,
  resolution: YtdlpResolution,
): YtdlpUpdatePhase {
  if (isSticky(phase)) {
    return phase;
  }
  if (resolution.fallbackBundledVersion) {
    return 'fallback';
  }
  return phase;
}

function isSticky(phase: YtdlpUpdatePhase): boolean {
  return (
    phase === 'updating' ||
    phase === 'success' ||
    phase === 'error-network' ||
    phase === 'error-checksum' ||
    phase === 'error-write' ||
    phase === 'up-to-date' ||
    phase === 'check-failed'
  );
}
