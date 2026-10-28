import type { YtdlpResolution } from '@src/infrastructure/youtube/resolveYtdlpExecutable.js';

import { ytdlpNoticeMessage } from '@src/domain/ytdlp/ytdlpUpdateCopy.js';
import { YtdlpUpdateFailure } from '@src/domain/ytdlp/YtdlpUpdateFailure.js';
import { YTDLP_CHECK_TIMEOUT_MS } from '@src/domain/ytdlp/ytdlpUpdatePolicy.js';
import {
  createYtdlpUpdateController,
  type YtdlpUpdateControllerDeps,
} from '@src/infrastructure/youtube/ytdlpUpdateController.js';
import { describe, expect, it, vi } from 'vitest';

const CURRENT = '2026.03.17';
const LATEST = '2026.08.19';

function resolution(overrides: Partial<YtdlpResolution> = {}): YtdlpResolution {
  return {
    executable: '/bundled/yt-dlp',
    source: 'bundled',
    version: CURRENT,
    ...overrides,
  };
}

function harness(
  overrides: Partial<YtdlpUpdateControllerDeps> = {},
): YtdlpUpdateControllerDeps & {
  fetchLatest: ReturnType<typeof vi.fn>;
  install: ReturnType<typeof vi.fn>;
  log: ReturnType<typeof vi.fn>;
  saveDismissedLatest: ReturnType<typeof vi.fn>;
} {
  const fetchLatest = vi.fn(async () => ({
    version: LATEST,
    publishedAt: '2026-08-19T00:00:00.000Z',
  }));
  const install = vi.fn(async () => {});
  const log = vi.fn();
  const saveDismissedLatest = vi.fn();
  return {
    resolve: () => resolution(),
    probe: vi.fn(async () => CURRENT),
    isBusy: () => false,
    now: () => new Date('2026-08-20T00:00:00.000Z'),
    env: {},
    ...overrides,
    fetchLatest: overrides.fetchLatest ?? fetchLatest,
    install: overrides.install ?? install,
    log: overrides.log ?? log,
    saveDismissedLatest: overrides.saveDismissedLatest ?? saveDismissedLatest,
  };
}

describe('ytdlp launch check', () => {
  it('warns when the stable release is newer and stays quiet when it is not', async () => {
    const deps = harness();
    const controller = createYtdlpUpdateController(deps);
    await controller.runLaunchCheck();
    const view = controller.getView();
    expect(view.phase).toBe('outdated');
    expect(view.current).toBe(CURRENT);
    expect(view.latest).toBe(LATEST);
    expect(view.manualCheckEnabled).toBe(false);
    expect(view.showLaunchDisclosure).toBe(true);
    expect(ytdlpNoticeMessage(view)).toContain('out of date');
    expect(deps.fetchLatest).toHaveBeenCalledWith(YTDLP_CHECK_TIMEOUT_MS);

    const current = harness({
      fetchLatest: vi.fn(async () => ({
        version: CURRENT,
        publishedAt: '2026-03-17T00:00:00.000Z',
      })),
    });
    const same = createYtdlpUpdateController(current);
    await same.runLaunchCheck();
    expect(same.getView().phase).toBe('idle');
    expect(same.getView().phase).not.toBe('up-to-date');
  });

  it('fails silently for offline, rate limits, timeout, and junk, and does not retry', async () => {
    const failures = [
      new Error('getaddrinfo ENOTFOUND'),
      new YtdlpUpdateFailure('network', 'HTTP 403'),
      new YtdlpUpdateFailure('network', 'HTTP 429'),
      new YtdlpUpdateFailure('network', 'timeout: aborted'),
      new YtdlpUpdateFailure('network', 'unparsable release'),
    ];
    for (const error of failures) {
      const deps = harness({
        fetchLatest: vi.fn(async () => {
          throw error;
        }),
      });
      const controller = createYtdlpUpdateController(deps);
      await controller.runLaunchCheck();
      await controller.runLaunchCheck();
      expect(controller.getView().phase).toBe('idle');
      expect(controller.getView().phase).not.toBe('up-to-date');
      expect(deps.fetchLatest).toHaveBeenCalledTimes(1);
      expect(deps.log).toHaveBeenCalledWith(error.message);
      expect(deps.install).not.toHaveBeenCalled();
    }
  });

  it('makes no network call for the four skip cases', async () => {
    const cases: Partial<YtdlpUpdateControllerDeps>[] = [
      {
        env: { YT_DLP_PATH: 'C:\\tools\\yt-dlp.exe' },
        resolve: () =>
          resolution({ source: 'env', executable: 'C:\\tools\\yt-dlp.exe' }),
      },
      {
        resolve: () =>
          resolution({
            source: 'path',
            version: undefined,
            executable: 'yt-dlp',
          }),
      },
      { env: { MAXFRAME_E2E: '1' } },
      { env: { MAXFRAME_CI_SMOKE: '1' } },
    ];
    const reasons = ['env', 'path', 'e2e', 'ci-smoke'];
    for (const [index, overrides] of cases.entries()) {
      const deps = harness(overrides);
      const controller = createYtdlpUpdateController(deps);
      await controller.runLaunchCheck();
      expect(deps.fetchLatest).not.toHaveBeenCalled();
      expect(deps.log).toHaveBeenCalledWith(`skipped: ${reasons[index]}`);
      expect(controller.getView().phase).not.toBe('up-to-date');
    }
  });

  it('honors grace days and a custom timeout', async () => {
    const deps = harness({
      graceDays: 7,
      timeoutMs: 50,
      now: () => new Date('2026-08-20T00:00:00.000Z'),
    });
    const controller = createYtdlpUpdateController(deps);
    await controller.runLaunchCheck();
    expect(controller.getView().phase).toBe('idle');
    expect(deps.fetchLatest).toHaveBeenCalledWith(50);

    const aged = harness({
      graceDays: 7,
      now: () => new Date('2026-08-26T00:00:00.000Z'),
    });
    const later = createYtdlpUpdateController(aged);
    await later.runLaunchCheck();
    expect(later.getView().phase).toBe('outdated');
  });
});

describe('ytdlp update actions', () => {
  it('installs only the version the main process found', async () => {
    const deps = harness();
    const controller = createYtdlpUpdateController(deps);
    await controller.runLaunchCheck();
    const view = await controller.startUpdate();
    expect(deps.install).toHaveBeenCalledTimes(1);
    expect(deps.install).toHaveBeenCalledWith(LATEST);
    expect(view.phase).toBe('success');
    expect(ytdlpNoticeMessage(view)).toBe(`yt-dlp updated to ${LATEST}.`);
  });

  it('keeps the current phase when an analyze or download is running', async () => {
    const deps = harness({ isBusy: () => true });
    const controller = createYtdlpUpdateController(deps);
    await controller.runLaunchCheck();
    const view = await controller.startUpdate();
    expect(deps.install).not.toHaveBeenCalled();
    expect(view.phase).toBe('outdated');
    expect(view.updateAllowed).toBe(false);
  });

  it('reports checksum, write, and network failures without claiming success', async () => {
    const reasons = ['checksum', 'write', 'network'] as const;
    for (const reason of reasons) {
      const deps = harness({
        install: vi.fn(async () => {
          throw new YtdlpUpdateFailure(reason, reason);
        }),
      });
      const controller = createYtdlpUpdateController(deps);
      await controller.runLaunchCheck();
      const view = await controller.startUpdate();
      expect(view.phase).toBe(`error-${reason}`);
      expect(view.current).toBe(CURRENT);
      expect(ytdlpNoticeMessage(view)).toContain(CURRENT);
    }
  });

  it('does not install over a user-managed binary', async () => {
    for (const source of ['env', 'path'] as const) {
      const deps = harness({
        resolve: () => resolution({ source, version: CURRENT }),
      });
      const controller = createYtdlpUpdateController(deps);
      await controller.startUpdate();
      expect(deps.install).not.toHaveBeenCalled();
    }
  });

  it('hides the warning for this session and can persist until a newer release', async () => {
    const deps = harness();
    const controller = createYtdlpUpdateController(deps);
    await controller.runLaunchCheck();
    expect(controller.dismiss().phase).toBe('idle');
    expect(deps.saveDismissedLatest).not.toHaveBeenCalled();

    const saved: string[] = [];
    const sticky = harness({
      snooze: 'until-newer',
      saveDismissedLatest: (version) => {
        saved.push(version);
      },
      loadDismissedLatest: () => saved[0],
    });
    const first = createYtdlpUpdateController(sticky);
    await first.runLaunchCheck();
    first.dismiss();
    expect(saved).toEqual([LATEST]);

    const second = createYtdlpUpdateController({
      ...sticky,
      loadDismissedLatest: () => LATEST,
    });
    await second.runLaunchCheck();
    expect(second.getView().phase).toBe('idle');

    const newer = createYtdlpUpdateController({
      ...sticky,
      loadDismissedLatest: () => LATEST,
      fetchLatest: vi.fn(async () => ({
        version: '2026.09.01',
        publishedAt: '2026-09-01T00:00:00.000Z',
      })),
    });
    await newer.runLaunchCheck();
    expect(newer.getView().phase).toBe('outdated');
    expect(newer.getView().latest).toBe('2026.09.01');
  });

  it('shows the fallback message and replaces the stored copy when asked', async () => {
    const deps = harness({
      resolve: () =>
        resolution({
          source: 'bundled',
          version: LATEST,
          fallbackBundledVersion: LATEST,
        }),
      fetchLatest: vi.fn(async () => ({
        version: LATEST,
        publishedAt: '2026-08-19T00:00:00.000Z',
      })),
    });
    const controller = createYtdlpUpdateController(deps);
    expect(controller.getView().phase).toBe('fallback');
    expect(ytdlpNoticeMessage(controller.getView())).toContain(LATEST);
    const view = await controller.startUpdate();
    expect(deps.install).toHaveBeenCalledWith(LATEST);
    expect(view.phase).toBe('success');
  });

  it('uses Check now only when that setting is on', async () => {
    const off = harness();
    const quiet = createYtdlpUpdateController(off);
    await quiet.checkNow();
    expect(off.fetchLatest).not.toHaveBeenCalled();

    const on = harness({ manualCheckEnabled: true });
    const controller = createYtdlpUpdateController(on);
    const view = await controller.checkNow();
    expect(view.phase).toBe('outdated');

    const current = harness({
      manualCheckEnabled: true,
      disclosure: 'readme',
      fetchLatest: vi.fn(async () => ({
        version: CURRENT,
        publishedAt: '2026-03-17T00:00:00.000Z',
      })),
    });
    const same = createYtdlpUpdateController(current);
    const upToDate = await same.checkNow();
    expect(upToDate.phase).toBe('up-to-date');
    expect(upToDate.showLaunchDisclosure).toBe(false);
    expect(ytdlpNoticeMessage(upToDate)).toContain('up to date');

    const failed = harness({
      manualCheckEnabled: true,
      fetchLatest: vi.fn(async () => {
        throw new YtdlpUpdateFailure('network', 'HTTP 403');
      }),
    });
    const broken = createYtdlpUpdateController(failed);
    const result = await broken.checkNow();
    expect(result.phase).toBe('check-failed');
    expect(failed.log).toHaveBeenCalledWith('HTTP 403');
  });
});
