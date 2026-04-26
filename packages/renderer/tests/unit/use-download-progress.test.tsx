import { act, renderHook } from '@testing-library/react';
import { useDownloadProgress } from '@ui/hooks/useDownloadProgress';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('useDownloadProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.maxframeApi = {
      getInitialAppState: vi.fn(),
      ping: vi.fn(),
      analyzeVideoUrl: vi.fn(),
      downloadVideo: vi.fn(),
      subscribeDownloadProgress: vi.fn(() => () => {}),
      cancelDownload: vi.fn(),
      setDebugMode: vi.fn().mockResolvedValue(undefined),
      getDiagnostics: vi.fn().mockResolvedValue(undefined),
      getLogPath: vi.fn().mockResolvedValue('C:\\AppData\\Maxframe\\maxframe-debug.log'),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts inactive with default state', () => {
    const { result } = renderHook(() => useDownloadProgress());
    expect(result.current.progress.active).toBe(false);
    expect(result.current.progress.percent).toBe(0);
    expect(result.current.progress.stage).toBe('waiting');
  });

  it('becomes active and updates state on progress lines', () => {
    let onProgress: ((e: { line: string }) => void) | undefined;
    window.maxframeApi.subscribeDownloadProgress = vi.fn((cb) => {
      onProgress = cb;
      return () => {};
    });

    const { result } = renderHook(() => useDownloadProgress());

    act(() => {
      onProgress?.({
        line: '[download]  42.5% of  200.00MiB at    3.50MiB/s ETA 00:33',
      });
    });

    expect(result.current.progress.active).toBe(true);
    expect(result.current.progress.percent).toBe(42.5);
    expect(result.current.progress.speedLabel).toBe('3.50MiB/s');
    expect(result.current.progress.etaLabel).toBe('00:33');
    expect(result.current.progress.sizeLabel).toBe('200.00MiB');
    expect(result.current.progress.stage).toBe('downloading');
  });

  it('ignores unrecognized lines (returns null from parser)', () => {
    let onProgress: ((e: { line: string }) => void) | undefined;
    window.maxframeApi.subscribeDownloadProgress = vi.fn((cb) => {
      onProgress = cb;
      return () => {};
    });

    const { result } = renderHook(() => useDownloadProgress());

    act(() => {
      onProgress?.({ line: '[download] Destination: video.mp4' });
    });

    expect(result.current.progress.active).toBe(false);
    expect(result.current.progress.percent).toBe(0);
  });

  it('flashes 100% for 800ms then self-clears on done stage', () => {
    let onProgress: ((e: { line: string }) => void) | undefined;
    window.maxframeApi.subscribeDownloadProgress = vi.fn((cb) => {
      onProgress = cb;
      return () => {};
    });

    const { result } = renderHook(() => useDownloadProgress());

    act(() => {
      onProgress?.({
        line: '[download] 100% of  100.00MiB in 00:20 at   5.00MiB/s',
      });
    });

    expect(result.current.progress.active).toBe(true);
    expect(result.current.progress.percent).toBe(100);
    expect(result.current.progress.stage).toBe('done');

    act(() => {
      vi.advanceTimersByTime(799);
    });
    expect(result.current.progress.active).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.progress.active).toBe(false);
    expect(result.current.progress.percent).toBe(0);
    expect(result.current.progress.stage).toBe('waiting');
  });

  it('clear() resets state immediately regardless of stage', () => {
    let onProgress: ((e: { line: string }) => void) | undefined;
    window.maxframeApi.subscribeDownloadProgress = vi.fn((cb) => {
      onProgress = cb;
      return () => {};
    });

    const { result } = renderHook(() => useDownloadProgress());

    act(() => {
      onProgress?.({
        line: '[download]  60.0% of  100.00MiB at    5.00MiB/s ETA 00:10',
      });
    });
    expect(result.current.progress.active).toBe(true);

    act(() => {
      result.current.clear();
    });
    expect(result.current.progress.active).toBe(false);
    expect(result.current.progress.percent).toBe(0);
  });

  it('unsubscribes on unmount', () => {
    const unsubscribe = vi.fn();
    window.maxframeApi.subscribeDownloadProgress = vi.fn(() => unsubscribe);

    const { unmount } = renderHook(() => useDownloadProgress());
    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('does nothing when subscribeDownloadProgress is unavailable', () => {
    window.maxframeApi = {
      ...window.maxframeApi,
      subscribeDownloadProgress: undefined as never,
    };
    const { result } = renderHook(() => useDownloadProgress());
    expect(result.current.progress.active).toBe(false);
  });
});
