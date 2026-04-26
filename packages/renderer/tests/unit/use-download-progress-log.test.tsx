import { act, renderHook } from '@testing-library/react';
import { useDownloadProgressLog } from '@ui/hooks/useDownloadProgressLog';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('useDownloadProgressLog', () => {
  beforeEach(() => {
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

  it('subscribes, trims long lines, keeps last 8, and clears', () => {
    let onProgress: ((event: { line: string }) => void) | undefined;
    const unsubscribe = vi.fn();
    window.maxframeApi.subscribeDownloadProgress = vi.fn((callback) => {
      onProgress = callback;
      return unsubscribe;
    });

    const { result, unmount } = renderHook(() => useDownloadProgressLog());
    expect(window.maxframeApi.subscribeDownloadProgress).toHaveBeenCalledTimes(
      1,
    );
    expect(onProgress).toBeTypeOf('function');

    act(() => {
      onProgress?.({ line: 'x'.repeat(200) });
    });
    expect(result.current.lines[0]?.length).toBeLessThanOrEqual(140);
    expect(result.current.lines[0]?.endsWith('…')).toBe(true);

    act(() => {
      for (let i = 1; i <= 10; i += 1) {
        onProgress?.({ line: `line-${i}` });
      }
    });
    expect(result.current.lines).toEqual([
      'line-3',
      'line-4',
      'line-5',
      'line-6',
      'line-7',
      'line-8',
      'line-9',
      'line-10',
    ]);

    act(() => {
      result.current.clear();
    });
    expect(result.current.lines).toEqual([]);

    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('does nothing when progress subscription API is unavailable', () => {
    window.maxframeApi = {
      ...window.maxframeApi,
      subscribeDownloadProgress: undefined as never,
    };

    const { result } = renderHook(() => useDownloadProgressLog());
    expect(result.current.lines).toEqual([]);
    act(() => {
      result.current.clear();
    });
    expect(result.current.lines).toEqual([]);
  });
});
