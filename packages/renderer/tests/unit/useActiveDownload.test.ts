import { act, renderHook, waitFor } from '@testing-library/react';
import { getLastOutputFolder } from '@ui/lib/appPreferences';
import { useActiveDownload } from '@ui/hooks/useActiveDownload';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const BASE_RESULT = {
  url: 'https://www.youtube.com/watch?v=vid',
  videoId: 'vid',
  title: 'My Video',
  uploader: 'My Channel',
  qualities: [
    {
      formatId: '137',
      container: 'mp4',
      resolutionLabel: '1080p',
      width: 1920,
      height: 1080,
      fps: 30,
      hasVideo: true,
      hasAudio: false,
    },
  ],
  audioQualities: [],
};

describe('useActiveDownload', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    window.maxframeApi = {
      getInitialAppState: vi.fn(),
      ping: vi.fn(),
      analyzeVideoUrl: vi.fn(),
      downloadVideo: vi.fn(),
      subscribeDownloadProgress: vi.fn(() => () => {}),
      cancelDownload: vi.fn().mockResolvedValue({ canceled: false }),
      setDebugMode: vi.fn(),
      getDiagnostics: vi.fn(),
      getLogPath: vi.fn(),
      showItemInFolder: vi.fn(),
    };
  });

  it('builds suggested filename from title and uploader', async () => {
    const downloadVideo = vi
      .fn()
      .mockResolvedValue({ outputPath: 'C:\\out\\file.mp4' });
    window.maxframeApi.downloadVideo = downloadVideo;

    const setError = vi.fn();
    const setDiagnosticsReport = vi.fn();
    const setReportCopied = vi.fn();

    const { result } = renderHook(() =>
      useActiveDownload({
        result: BASE_RESULT,
        outputMode: 'mp4',
        debugMode: false,
        setError,
        setDiagnosticsReport,
        setReportCopied,
      }),
    );

    await act(async () => {
      await result.current.downloadQuality('137', false);
    });

    expect(downloadVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        suggestedFileName: 'My Video - My Channel.mp4',
      }),
    );
  });

  it('calls cancelDownload when cancelActiveDownload runs', async () => {
    const cancelDownload = vi.fn().mockResolvedValue({ canceled: true });
    window.maxframeApi.cancelDownload = cancelDownload;

    const { result } = renderHook(() =>
      useActiveDownload({
        result: BASE_RESULT,
        outputMode: 'mp4',
        debugMode: false,
        setError: vi.fn(),
        setDiagnosticsReport: vi.fn(),
        setReportCopied: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.cancelActiveDownload();
    });

    expect(cancelDownload).toHaveBeenCalled();
  });

  it('sets savedPath and downloadNote on success', async () => {
    window.maxframeApi.downloadVideo = vi
      .fn()
      .mockResolvedValue({ outputPath: 'C:\\Downloads\\video.mp4' });

    const { result } = renderHook(() =>
      useActiveDownload({
        result: BASE_RESULT,
        outputMode: 'mp4',
        debugMode: false,
        setError: vi.fn(),
        setDiagnosticsReport: vi.fn(),
        setReportCopied: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.downloadQuality('137', false);
    });

    await waitFor(() => {
      expect(result.current.savedPath).toBe('C:\\Downloads\\video.mp4');
      expect(result.current.downloadNote).toBe(
        'Saved to C:\\Downloads\\video.mp4',
      );
    });
    expect(getLastOutputFolder()).toBe('C:\\Downloads');
  });

  it('does not set error when download is canceled', async () => {
    window.maxframeApi.downloadVideo = vi
      .fn()
      .mockRejectedValue(new Error('Download canceled.'));

    const setError = vi.fn();

    const { result } = renderHook(() =>
      useActiveDownload({
        result: BASE_RESULT,
        outputMode: 'mp4',
        debugMode: false,
        setError,
        setDiagnosticsReport: vi.fn(),
        setReportCopied: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.downloadQuality('137', false);
    });

    expect(setError).not.toHaveBeenCalledWith('Download canceled.');
    expect(result.current.downloadNote).toBeUndefined();
  });
});
