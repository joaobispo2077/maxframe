import { act, renderHook, waitFor } from '@testing-library/react';
import { useActiveDownload } from '@ui/hooks/useActiveDownload';
import { getLastOutputFolder } from '@ui/lib/appPreferences';
import { MISSING_OUTPUT_FILE_MESSAGE } from '@ui/lib/userFacingErrors';
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

  it('shows the missing-file message when the download file is gone', async () => {
    window.maxframeApi.downloadVideo = vi
      .fn()
      .mockRejectedValue(
        new Error(
          'Download finished but no output file was found next to the path you chose. Check the folder for a new .mp4 or .mkv file, or inspect the yt-dlp error output above.',
        ),
      );

    const setError = vi.fn();

    const { result } = renderHook(() =>
      useActiveDownload({
        result: BASE_RESULT,
        outputMode: 'mp4',
        setError,
        setDiagnosticsReport: vi.fn(),
        setReportCopied: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.downloadQuality('137', false);
    });

    expect(setError).toHaveBeenCalledWith(MISSING_OUTPUT_FILE_MESSAGE);
  });

  it('maps a missing-file error that arrives with the Electron IPC prefix', async () => {
    const mainMessage =
      'Download finished but no output file was found next to the path you chose. Check the folder for a new .mp4 or .mkv file, or inspect the yt-dlp error output above.';
    window.maxframeApi.downloadVideo = vi
      .fn()
      .mockRejectedValue(
        new Error(
          `Error invoking remote method 'app:download-video': Error: ${mainMessage}`,
        ),
      );

    const setError = vi.fn();
    const { result } = renderHook(() =>
      useActiveDownload({
        result: BASE_RESULT,
        outputMode: 'mp4',
        setError,
        setDiagnosticsReport: vi.fn(),
        setReportCopied: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.downloadQuality('137', false);
    });

    expect(setError).toHaveBeenCalledWith(MISSING_OUTPUT_FILE_MESSAGE);
    expect(setError).not.toHaveBeenCalledWith(
      expect.stringContaining('Error invoking remote method'),
    );
  });

  it('does not set an error when a canceled download is IPC-prefixed', async () => {
    window.maxframeApi.downloadVideo = vi
      .fn()
      .mockRejectedValue(
        new Error(
          "Error invoking remote method 'app:download-video': Error: Download canceled.",
        ),
      );

    const setError = vi.fn();
    const { result } = renderHook(() =>
      useActiveDownload({
        result: BASE_RESULT,
        outputMode: 'mp4',
        setError,
        setDiagnosticsReport: vi.fn(),
        setReportCopied: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.downloadQuality('137', false);
    });

    const shown = setError.mock.calls
      .map((call) => call[0])
      .filter((message) => message !== undefined);
    expect(shown).toEqual([]);
    expect(result.current.downloadNote).toBeUndefined();
  });

  it('retries the same url and format', async () => {
    const downloadVideo = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ outputPath: 'C:\\out\\file.mp4' });
    window.maxframeApi.downloadVideo = downloadVideo;

    const { result } = renderHook(() =>
      useActiveDownload({
        result: BASE_RESULT,
        outputMode: 'mp4',
        setError: vi.fn(),
        setDiagnosticsReport: vi.fn(),
        setReportCopied: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.downloadQuality('137', false);
    });
    await act(async () => {
      result.current.retryDownload();
    });

    expect(downloadVideo).toHaveBeenCalledTimes(2);
    expect(downloadVideo.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        url: BASE_RESULT.url,
        formatId: '137',
        hasAudio: false,
        outputMode: 'mp4',
      }),
    );
  });
});
