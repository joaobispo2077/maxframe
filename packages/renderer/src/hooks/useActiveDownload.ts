import type { AnalyzeVideoResult } from '../lib/analyzeVideoResultType.js';
import type { DiagnosticsReport } from '../maxframe-api.js';

import { useRef, useState } from 'react';

import { isDownloadCanceled } from '@src/domain/errors/ipcErrorMessage.js';

import {
  parentFolderFromFilePath,
  setLastOutputFolder,
} from '../lib/appPreferences.js';
import { buildSuggestedFileName } from '../lib/buildSuggestedFileName.js';
import { userFacingDownloadError } from '../lib/userFacingErrors.js';

import { useDownloadProgress } from './useDownloadProgress.js';

type UseActiveDownloadOptions = {
  result: AnalyzeVideoResult | undefined;
  outputMode: 'mp3' | 'mp4';
  setError: (error: string | undefined) => void;
  setDiagnosticsReport: (report: DiagnosticsReport | undefined) => void;
  setReportCopied: (copied: boolean) => void;
};

export function useActiveDownload({
  result,
  outputMode,
  setError,
  setDiagnosticsReport,
  setReportCopied,
}: UseActiveDownloadOptions) {
  const [downloadFormatId, setDownloadFormatId] = useState<string>();
  const [downloadNote, setDownloadNote] = useState<string>();
  const [savedPath, setSavedPath] = useState<string>();
  const [hoveredFormatId, setHoveredFormatId] = useState<string | null>(null);
  const lastAttemptRef = useRef<{ formatId: string; hasAudio: boolean } | null>(
    null,
  );
  const { progress, clear: clearDownloadProgress } = useDownloadProgress();

  const downloadBusy = Boolean(downloadFormatId);

  async function fetchDiagnostics(): Promise<void> {
    try {
      const report = await window.maxframeApi.getDiagnostics();
      setDiagnosticsReport(report);
    } catch {
      // diagnostic fetch failure should not surface to user
    }
  }

  async function cancelActiveDownload(): Promise<void> {
    try {
      await window.maxframeApi.cancelDownload();
    } catch {
      /* ignore */
    }
  }

  async function downloadQuality(
    formatId: string,
    hasAudio: boolean,
  ): Promise<void> {
    if (!result) {
      return;
    }
    lastAttemptRef.current = { formatId, hasAudio };
    setDownloadFormatId(formatId);
    clearDownloadProgress();
    setError(undefined);
    setDownloadNote(undefined);
    setSavedPath(undefined);
    setDiagnosticsReport(undefined);
    setReportCopied(false);
    try {
      const suggestedFileName = buildSuggestedFileName({
        title: result.title,
        videoId: result.videoId,
        uploader: result.uploader,
        outputMode,
      });
      const { outputPath } = await window.maxframeApi.downloadVideo({
        url: result.url,
        formatId,
        hasAudio,
        suggestedFileName,
        outputMode,
      });
      setDownloadNote(`Saved to ${outputPath}`);
      setSavedPath(outputPath);
      setLastOutputFolder(parentFolderFromFilePath(outputPath));
    } catch (caughtError) {
      const raw =
        caughtError instanceof Error ? caughtError.message : 'Unknown error';
      if (isDownloadCanceled(raw)) {
        setError(undefined);
        setDownloadNote(undefined);
      } else {
        setError(userFacingDownloadError(raw));
        void fetchDiagnostics();
      }
    } finally {
      setDownloadFormatId(undefined);
      clearDownloadProgress();
    }
  }

  function clearSaveMessage(): void {
    setDownloadNote(undefined);
    setSavedPath(undefined);
  }

  function retryDownload(): void {
    const last = lastAttemptRef.current;
    if (!last) {
      return;
    }
    void downloadQuality(last.formatId, last.hasAudio);
  }

  return {
    downloadFormatId,
    downloadBusy,
    downloadNote,
    savedPath,
    progress,
    downloadQuality,
    retryDownload,
    cancelActiveDownload,
    clearSaveMessage,
    hoveredFormatId,
    setHoveredFormatId,
  };
}
