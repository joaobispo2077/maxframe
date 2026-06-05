import { act, renderHook, waitFor } from '@testing-library/react';
import { useAnalyzeFlow } from '@ui/hooks/useAnalyzeFlow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('useAnalyzeFlow', () => {
  const enqueueBulkText = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    enqueueBulkText.mockReset();
    window.maxframeApi = {
      getInitialAppState: vi.fn(),
      ping: vi.fn(),
      analyzeVideoUrl: vi.fn(),
      downloadVideo: vi.fn(),
      subscribeDownloadProgress: vi.fn(() => () => {}),
      cancelDownload: vi.fn(),
      pickOutputFolder: vi.fn(),
      setDebugMode: vi.fn(),
      getDiagnostics: vi.fn(),
      getLogPath: vi.fn(),
      showItemInFolder: vi.fn(),
    };
  });

  it('calls analyzeVideoUrl with only the first non-empty line', async () => {
    const analyzeVideoUrl = vi.fn().mockResolvedValue({
      url: 'https://www.youtube.com/watch?v=first',
      videoId: 'first',
      title: 'T',
      uploader: 'U',
      qualities: [],
      audioQualities: [],
    });
    window.maxframeApi.analyzeVideoUrl = analyzeVideoUrl;

    const { result } = renderHook(() =>
      useAnalyzeFlow({ enqueueBulkText, debugMode: false }),
    );

    act(() => {
      result.current.setUrlsText(
        'https://www.youtube.com/watch?v=first\nhttps://youtu.be/second',
      );
    });

    await act(async () => {
      await result.current.analyzeUrl();
    });

    expect(analyzeVideoUrl).toHaveBeenCalledWith(
      'https://www.youtube.com/watch?v=first',
    );
  });

  it('clears error when starting a new analyze', async () => {
    window.maxframeApi.analyzeVideoUrl = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce({
        url: 'https://www.youtube.com/watch?v=ok',
        videoId: 'ok',
        title: 'T',
        uploader: 'U',
        qualities: [],
        audioQualities: [],
      });

    const { result } = renderHook(() =>
      useAnalyzeFlow({ enqueueBulkText, debugMode: false }),
    );

    act(() => {
      result.current.setUrlsText('https://www.youtube.com/watch?v=ok');
    });

    await act(async () => {
      await result.current.analyzeUrl();
    });
    expect(result.current.error).toBe('fail');

    await act(async () => {
      await result.current.analyzeUrl();
    });
    await waitFor(() => {
      expect(result.current.error).toBeUndefined();
    });
  });

  it('initializes output mode from saved default preference', () => {
    localStorage.setItem('maxframe.defaultOutputMode', 'mp3');

    const { result } = renderHook(() =>
      useAnalyzeFlow({ enqueueBulkText, debugMode: false }),
    );

    expect(result.current.outputMode).toBe('mp3');
  });

  it('clears textarea after enqueue via handleAddToQueue', () => {
    const { result } = renderHook(() =>
      useAnalyzeFlow({ enqueueBulkText, debugMode: false }),
    );

    act(() => {
      result.current.setUrlsText('https://youtu.be/abc\nhttps://youtu.be/def');
    });

    act(() => {
      result.current.handleAddToQueue();
    });

    expect(enqueueBulkText).toHaveBeenCalledWith(
      'https://youtu.be/abc\nhttps://youtu.be/def',
    );
    expect(result.current.urlsText).toBe('');
  });
});
