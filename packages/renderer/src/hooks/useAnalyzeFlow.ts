import type { AnalyzeVideoResult } from '../lib/analyzeVideoResultType.js';
import type { DiagnosticsReport } from '../maxframe-api.js';

import { useState } from 'react';

import { getDefaultOutputMode } from '../lib/appPreferences.js';
import { buildDiagnosticReport } from '../lib/buildDiagnosticReport.js';
import { firstNonEmptyLine } from '../lib/firstNonEmptyLine.js';

type UseAnalyzeFlowOptions = {
  enqueueBulkText: (text: string) => void;
  debugMode: boolean;
};

export function useAnalyzeFlow({
  enqueueBulkText,
  debugMode,
}: UseAnalyzeFlowOptions) {
  const [urlsText, setUrlsText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<AnalyzeVideoResult>();
  const [outputMode, setOutputMode] = useState<'mp3' | 'mp4'>(getDefaultOutputMode);
  const [diagnosticsReport, setDiagnosticsReport] = useState<
    DiagnosticsReport | undefined
  >();
  const [reportCopied, setReportCopied] = useState(false);

  const analyzeTargetUrl = firstNonEmptyLine(urlsText);
  const canAddToQueue = urlsText.trim().length > 0;

  async function fetchDiagnostics(): Promise<void> {
    try {
      const report = await window.maxframeApi.getDiagnostics();
      setDiagnosticsReport(report);
    } catch {
      // diagnostic fetch failure should not surface to user
    }
  }

  function handleCopyReport(): void {
    if (!diagnosticsReport) return;
    const text = buildDiagnosticReport(diagnosticsReport);
    void navigator.clipboard.writeText(text).then(() => {
      setReportCopied(true);
      setTimeout(() => setReportCopied(false), 2000);
    });
  }

  async function analyzeUrl(): Promise<void> {
    const urlToAnalyze = analyzeTargetUrl;
    if (!urlToAnalyze) {
      return;
    }

    setLoading(true);
    setError(undefined);
    setDiagnosticsReport(undefined);
    setReportCopied(false);

    try {
      const analysis = await window.maxframeApi.analyzeVideoUrl(urlToAnalyze);
      setResult(analysis);
    } catch (caughtError) {
      setResult(undefined);
      setError(
        caughtError instanceof Error ? caughtError.message : 'Unknown error',
      );
      if (debugMode) {
        void fetchDiagnostics();
      }
    } finally {
      setLoading(false);
    }
  }

  function handleAddToQueue(): void {
    enqueueBulkText(urlsText);
    setUrlsText('');
  }

  function clearSaveState(): void {
    setError(undefined);
    setDiagnosticsReport(undefined);
    setReportCopied(false);
  }

  return {
    urlsText,
    setUrlsText,
    loading,
    error,
    setError,
    result,
    setResult,
    outputMode,
    setOutputMode,
    analyzeTargetUrl,
    canAddToQueue,
    analyzeUrl,
    handleAddToQueue,
    diagnosticsReport,
    setDiagnosticsReport,
    reportCopied,
    setReportCopied,
    handleCopyReport,
    clearSaveState,
  };
}
