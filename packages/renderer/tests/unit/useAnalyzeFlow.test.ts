import { act, renderHook, waitFor } from '@testing-library/react';
import { useAnalyzeFlow } from '@ui/hooks/useAnalyzeFlow';
import { ANALYZE_FAILURE_MESSAGE } from '@ui/lib/userFacingErrors';
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
    expect(result.current.error).toBe(ANALYZE_FAILURE_MESSAGE);

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

  it('copies a report that masks the Windows user and omits PATH', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    const { result } = renderHook(() =>
      useAnalyzeFlow({ enqueueBulkText, debugMode: false }),
    );

    act(() => {
      result.current.setDiagnosticsReport({
        ytdlpPath: 'C:\\Users\\Joao\\yt-dlp.exe',
        ytdlpFound: true,
        ffmpegPath: 'C:/Users/Joao/ffmpeg.exe',
        ffmpegFound: false,
        platform: 'win32',
        arch: 'x64',
        appVersion: '1.8.1',
        pathEnv: 'C:\\Users\\Joao\\bin;C:\\Windows\\system32',
        lastError: 'USERNAME=Joao',
        lastErrorDetail: undefined,
        lastSubmittedUrl: 'https://www.youtube.com/watch?v=abc',
        ytdlpVersion: '2026.08.19',
      });
    });

    act(() => {
      result.current.handleCopyReport();
    });

    const text = writeText.mock.calls[0]?.[0] as string;
    expect(text).toContain('Found');
    expect(text).toContain('Missing');
    expect(text).not.toContain('[FOUND]');
    expect(text).not.toContain('[NOT FOUND]');
    expect(text).not.toMatch(/joao/i);
    expect(text).not.toContain('PATH (first 500 chars)');
    expect(text).not.toContain('C:\\Users\\Joao\\bin');
    expect(text).toContain('USERNAME=<user>');
  });
});
