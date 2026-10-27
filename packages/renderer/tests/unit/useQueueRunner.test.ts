import { useReducer } from 'react';

import {
  createEmptyQueueModel,
  enqueueJobs,
} from '@src/domain/download-queue/model.js';
import { act, renderHook, waitFor } from '@testing-library/react';
import { queueReducer, type QueueAction } from '@ui/hooks/useDownloadQueue';
import { useQueueRunner } from '@ui/hooks/useQueueRunner';
import {
  GENERIC_DOWNLOAD_ERROR_MESSAGE,
  MISSING_OUTPUT_FILE_MESSAGE,
  YOUTUBE_BLOCKED_MESSAGE,
} from '@ui/lib/userFacingErrors';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const QUALITY = {
  formatId: '137',
  container: 'mp4',
  resolutionLabel: '1080p',
  width: 1920,
  height: 1080,
  fps: 30,
  hasVideo: true,
  hasAudio: false,
};

function analyzeResult(url: string, videoId: string, title: string) {
  return {
    url,
    videoId,
    title,
    uploader: 'Channel',
    qualities: [QUALITY],
    bestQuality: QUALITY,
    audioQualities: [],
  };
}

function useHarness(
  entries: { id: string; url: string }[],
  downloadBusy = false,
) {
  const [model, dispatch] = useReducer(
    queueReducer,
    enqueueJobs(createEmptyQueueModel(), entries),
  );
  const runner = useQueueRunner({
    model,
    dispatch,
    outputMode: 'mp4',
    downloadBusy,
  });
  return { model, dispatch, runner };
}

describe('useQueueRunner', () => {
  let progressListener: ((payload: { line: string }) => void) | undefined;
  let downloadResolve: ((value: { outputPath: string }) => void) | undefined;

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    localStorage.setItem('maxframe.lastOutputFolder', 'C:\\Batch');
    progressListener = undefined;
    downloadResolve = undefined;

    window.maxframeApi = {
      getInitialAppState: vi.fn(),
      ping: vi.fn(),
      analyzeVideoUrl: vi.fn(async (url: string) => {
        if (url.includes('aaa')) {
          return analyzeResult(url, 'aaa', 'Video A');
        }
        return analyzeResult(url, 'bbb', 'Video B');
      }),
      downloadVideo: vi.fn(
        () =>
          new Promise<{ outputPath: string }>((resolve) => {
            downloadResolve = resolve;
          }),
      ),
      subscribeDownloadProgress: vi.fn((listener) => {
        progressListener = listener;
        return () => {
          progressListener = undefined;
        };
      }),
      cancelDownload: vi.fn().mockResolvedValue({ canceled: true }),
      pickOutputFolder: vi.fn().mockResolvedValue({
        canceled: false,
        folderPath: 'C:\\Picked',
      }),
      setDebugMode: vi.fn(),
      getDiagnostics: vi.fn(),
      getLogPath: vi.fn(),
      showItemInFolder: vi.fn(),
    };
  });

  it('processes two jobs through analyze and download into history', async () => {
    const downloadVideo = vi
      .fn()
      .mockResolvedValue({ outputPath: 'C:\\Batch\\Video A - Channel.mp4' });
    window.maxframeApi.downloadVideo = downloadVideo;

    const { result } = renderHook(() =>
      useHarness([
        { id: 'j1', url: 'https://www.youtube.com/watch?v=aaa' },
        { id: 'j2', url: 'https://www.youtube.com/watch?v=bbb' },
      ]),
    );

    await act(async () => {
      await result.current.runner.start();
    });

    await waitFor(
      () => {
        expect(result.current.model.historyJobs).toHaveLength(2);
        expect(result.current.model.jobs).toHaveLength(0);
      },
      { timeout: 8000 },
    );

    expect(window.maxframeApi.analyzeVideoUrl).toHaveBeenCalledTimes(2);
    expect(downloadVideo).toHaveBeenCalledTimes(2);
    expect(downloadVideo.mock.calls[0]?.[0]?.outputDir).toBe('C:\\Batch');
    expect(result.current.runner.running).toBe(false);
  });

  it('stop mid-download cancels active job', async () => {
    let rejectDownload: ((error: Error) => void) | undefined;
    window.maxframeApi.downloadVideo = vi.fn(
      () =>
        new Promise<{ outputPath: string }>((_resolve, reject) => {
          rejectDownload = reject;
        }),
    );
    window.maxframeApi.cancelDownload = vi.fn().mockImplementation(async () => {
      rejectDownload?.(new Error('Download canceled.'));
      return { canceled: true };
    });

    const { result } = renderHook(() =>
      useHarness([{ id: 'j1', url: 'https://www.youtube.com/watch?v=aaa' }]),
    );

    await act(async () => {
      await result.current.runner.start();
    });

    await waitFor(() => {
      expect(window.maxframeApi.downloadVideo).toHaveBeenCalled();
    });

    await act(async () => {
      await result.current.runner.stop();
    });

    await waitFor(() => {
      expect(result.current.model.historyJobs[0]?.terminal).toBe('cancelled');
    });

    expect(window.maxframeApi.cancelDownload).toHaveBeenCalled();
  });

  it('marks analyze failure and continues with next job', async () => {
    window.maxframeApi.analyzeVideoUrl = vi.fn(async (url: string) => {
      if (url.includes('fail')) {
        throw new Error('network down');
      }
      return analyzeResult(url, 'ok', 'OK Video');
    });
    window.maxframeApi.downloadVideo = vi
      .fn()
      .mockResolvedValue({ outputPath: 'C:\\Batch\\ok.mp4' });

    const { result } = renderHook(() =>
      useHarness([
        { id: 'j1', url: 'https://www.youtube.com/watch?v=fail' },
        { id: 'j2', url: 'https://www.youtube.com/watch?v=ok' },
      ]),
    );

    await act(async () => {
      await result.current.runner.start();
    });

    await waitFor(
      () => {
        expect(result.current.model.historyJobs).toHaveLength(2);
      },
      { timeout: 8000 },
    );

    expect(result.current.model.historyJobs[0]?.terminal).toBe('failed');
    expect(result.current.model.historyJobs[1]?.terminal).toBe('complete');
  });

  it('prompts for output folder when last folder is unset', async () => {
    localStorage.removeItem('maxframe.lastOutputFolder');
    window.maxframeApi.downloadVideo = vi
      .fn()
      .mockResolvedValue({ outputPath: 'C:\\Picked\\Video A - Channel.mp4' });

    const { result } = renderHook(() =>
      useHarness([{ id: 'j1', url: 'https://www.youtube.com/watch?v=aaa' }]),
    );

    await act(async () => {
      await result.current.runner.start();
    });

    expect(window.maxframeApi.pickOutputFolder).toHaveBeenCalled();

    await waitFor(() => {
      expect(result.current.model.historyJobs).toHaveLength(1);
    });

    expect(localStorage.getItem('maxframe.lastOutputFolder')).toBe(
      'C:\\Picked',
    );
  });

  it('fails job when resolveBestDownload returns undefined', async () => {
    window.maxframeApi.analyzeVideoUrl = vi.fn().mockResolvedValue({
      url: 'https://www.youtube.com/watch?v=nobest',
      videoId: 'nobest',
      title: 'No Best',
      uploader: 'Ch',
      qualities: [],
      audioQualities: [],
    });

    const { result } = renderHook(() =>
      useHarness([{ id: 'j1', url: 'https://www.youtube.com/watch?v=nobest' }]),
    );

    await act(async () => {
      await result.current.runner.start();
    });

    await waitFor(() => {
      expect(result.current.model.historyJobs[0]?.terminal).toBe('failed');
      expect(result.current.model.historyJobs[0]?.status).toBe(
        'No suitable format',
      );
    });

    expect(window.maxframeApi.downloadVideo).not.toHaveBeenCalled();
  });

  it('cancels a job when the IPC-prefixed message is Download canceled.', async () => {
    window.maxframeApi.downloadVideo = vi
      .fn()
      .mockRejectedValue(
        new Error(
          "Error invoking remote method 'app:download-video': Error: Download canceled.",
        ),
      );

    const { result } = renderHook(() =>
      useHarness([{ id: 'j1', url: 'https://www.youtube.com/watch?v=aaa' }]),
    );

    await act(async () => {
      await result.current.runner.start();
    });

    await waitFor(() => {
      expect(result.current.model.historyJobs[0]?.terminal).toBe('cancelled');
    });
  });

  it('maps an IPC-prefixed 403 and an unknown download error in the queue', async () => {
    const missing =
      'Download finished but no output file was found next to the path you chose. Check the folder for a new .mp4 or .mkv file, or inspect the yt-dlp error output above.';
    window.maxframeApi.downloadVideo = vi
      .fn()
      .mockRejectedValueOnce(
        new Error(
          "Error invoking remote method 'app:download-video': Error: ERROR: HTTP Error 403: Forbidden",
        ),
      )
      .mockRejectedValueOnce(
        new Error(
          `Error invoking remote method 'app:download-video': Error: ${missing}`,
        ),
      )
      .mockRejectedValueOnce(
        new Error(
          "Error invoking remote method 'app:download-video': Error: ERROR: something else broke",
        ),
      );

    const { result } = renderHook(() =>
      useHarness([
        { id: 'j1', url: 'https://www.youtube.com/watch?v=aaa' },
        { id: 'j2', url: 'https://www.youtube.com/watch?v=bbb' },
        { id: 'j3', url: 'https://www.youtube.com/watch?v=ccc' },
      ]),
    );

    await act(async () => {
      await result.current.runner.start();
    });

    await waitFor(
      () => {
        expect(result.current.model.historyJobs).toHaveLength(3);
      },
      { timeout: 8000 },
    );

    const details = result.current.model.historyJobs.map(
      (job) => job.statusDetail,
    );
    expect(details).toEqual([
      YOUTUBE_BLOCKED_MESSAGE,
      MISSING_OUTPUT_FILE_MESSAGE,
      GENERIC_DOWNLOAD_ERROR_MESSAGE,
    ]);
    expect(details.join('\n')).not.toContain('Error invoking remote method');
    expect(result.current.model.historyJobs.map((job) => job.id)).toEqual([
      'j1',
      'j2',
      'j3',
    ]);
  });

  it('leaves the other rows alone when one download fails', async () => {
    window.maxframeApi.analyzeVideoUrl = vi.fn(async (url: string) => {
      if (url.includes('ccc')) {
        return analyzeResult(url, 'ccc', 'Video C');
      }
      return analyzeResult(url, url.slice(-3), 'Video');
    });
    window.maxframeApi.downloadVideo = vi
      .fn()
      .mockResolvedValueOnce({ outputPath: 'C:\\Batch\\a.mp4' })
      .mockRejectedValueOnce(
        new Error(
          "Error invoking remote method 'app:download-video': Error: ERROR: something else broke",
        ),
      )
      .mockResolvedValueOnce({ outputPath: 'C:\\Batch\\c.mp4' });

    const { result } = renderHook(() =>
      useHarness([
        { id: 'j1', url: 'https://www.youtube.com/watch?v=aaa' },
        { id: 'j2', url: 'https://www.youtube.com/watch?v=bbb' },
        { id: 'j3', url: 'https://www.youtube.com/watch?v=ccc' },
      ]),
    );

    await act(async () => {
      await result.current.runner.start();
    });

    await waitFor(() => {
      expect(result.current.model.historyJobs).toHaveLength(3);
    });

    expect(result.current.model.historyJobs.map((job) => job.terminal)).toEqual(
      ['complete', 'failed', 'complete'],
    );
    expect(result.current.model.historyJobs[0]?.statusDetail).toBeUndefined();
    expect(result.current.model.historyJobs[1]?.statusDetail).toBe(
      GENERIC_DOWNLOAD_ERROR_MESSAGE,
    );
    expect(result.current.model.historyJobs[2]?.outputPath).toBe(
      'C:\\Batch\\c.mp4',
    );
  });

  it('does not start when analyze download is busy', async () => {
    const { result } = renderHook(() =>
      useHarness(
        [{ id: 'j1', url: 'https://www.youtube.com/watch?v=aaa' }],
        true,
      ),
    );

    await act(async () => {
      await result.current.runner.start();
    });

    expect(result.current.runner.running).toBe(false);
    expect(window.maxframeApi.analyzeVideoUrl).not.toHaveBeenCalled();
  });
});
