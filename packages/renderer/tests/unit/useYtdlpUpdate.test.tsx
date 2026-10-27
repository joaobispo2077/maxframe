import type { YtdlpUpdateView } from '@src/domain/ytdlp/ytdlpUpdateView';

import { act, renderHook, waitFor } from '@testing-library/react';
import { useYtdlpUpdate } from '@ui/hooks/useYtdlpUpdate';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function view(phase: YtdlpUpdateView['phase']): YtdlpUpdateView {
  return {
    version: '2026.03.17',
    source: 'bundled',
    phase,
    current: '2026.03.17',
    latest: '2026.08.19',
    bundled: '2026.03.17',
    manualCheckEnabled: false,
    showLaunchDisclosure: true,
    updateAllowed: true,
  };
}

describe('useYtdlpUpdate', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('does nothing when the bridge is missing', async () => {
    delete (window as { maxframeApi?: unknown }).maxframeApi;
    const { result } = renderHook(() => useYtdlpUpdate());
    await act(async () => {
      await result.current.update();
      await result.current.dismiss();
      await result.current.checkNow();
    });
    expect(result.current.view).toBeUndefined();
  });

  it('does nothing when the preload methods are absent', async () => {
    window.maxframeApi = {
      getInitialAppState: vi.fn(),
      ping: vi.fn(),
      analyzeVideoUrl: vi.fn(),
      downloadVideo: vi.fn(),
      subscribeDownloadProgress: vi.fn(() => () => {}),
      cancelDownload: vi.fn(),
      setDebugMode: vi.fn(),
      getDiagnostics: vi.fn(),
      getLogPath: vi.fn(),
      showItemInFolder: vi.fn(),
    };
    const { result } = renderHook(() => useYtdlpUpdate());
    await act(async () => {
      await result.current.update();
      await result.current.dismiss();
      await result.current.checkNow();
    });
    expect(result.current.view).toBeUndefined();
  });

  it('keeps a pushed status ahead of a slower first read', async () => {
    let listener: ((view: YtdlpUpdateView) => void) | undefined;
    let resolveStatus: (view: YtdlpUpdateView) => void = () => {};
    const start = vi.fn(async () => view('success'));
    const dismiss = vi.fn(async () => view('idle'));
    const check = vi.fn(async () => view('up-to-date'));
    window.maxframeApi = {
      getInitialAppState: vi.fn(),
      ping: vi.fn(),
      analyzeVideoUrl: vi.fn(),
      downloadVideo: vi.fn(),
      subscribeDownloadProgress: vi.fn(() => () => {}),
      cancelDownload: vi.fn(),
      setDebugMode: vi.fn(),
      getDiagnostics: vi.fn(),
      getLogPath: vi.fn(),
      showItemInFolder: vi.fn(),
      getYtdlpUpdateStatus: () =>
        new Promise((resolve) => {
          resolveStatus = resolve;
        }),
      subscribeYtdlpUpdate: (next) => {
        listener = next;
        return () => {
          listener = undefined;
        };
      },
      startYtdlpUpdate: start,
      dismissYtdlpUpdate: dismiss,
      checkYtdlpUpdate: check,
    };

    const { result } = renderHook(() => useYtdlpUpdate());
    await act(async () => {
      listener?.(view('outdated'));
      resolveStatus(view('idle'));
    });
    await waitFor(() => {
      expect(result.current.view?.phase).toBe('outdated');
    });

    await act(async () => {
      await result.current.update();
    });
    expect(start).toHaveBeenCalledWith();
    expect(result.current.view?.phase).toBe('success');

    await act(async () => {
      await result.current.dismiss();
      await result.current.checkNow();
    });
    expect(dismiss).toHaveBeenCalledWith();
    expect(check).toHaveBeenCalledWith();
    expect(result.current.view?.phase).toBe('up-to-date');
  });
});
