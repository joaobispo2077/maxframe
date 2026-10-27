import type { AnalyzeVideoResult } from '../lib/analyzeVideoResultType.js';
import type { DiagnosticsReport } from '../maxframe-api.js';

import { useState } from 'react';

import { buildDiagnosticReport } from '@src/infrastructure/diagnostics/buildDiagnosticReport.js';

import { getDefaultOutputMode } from '../lib/appPreferences.js';
import {
  countNonEmptyLines,
  firstNonEmptyLine,
} from '../lib/firstNonEmptyLine.js';
import { ANALYZE_FAILURE_MESSAGE } from '../lib/userFacingErrors.js';

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
  const [outputMode, setOutputMode] = useState<'mp3' | 'mp4'>(
    getDefaultOutputMode,
  );
  const [diagnosticsReport, setDiagnosticsReport] = useState<
    DiagnosticsReport | undefined
  >();
  const [reportCopied, setReportCopied] = useState(false);

  const analyzeTargetUrl = firstNonEmptyLine(urlsText);
  const linkCount = countNonEmptyLines(urlsText);
  const canAddToQueue = linkCount > 0;

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
    } catch {
      setResult(undefined);
      setError(ANALYZE_FAILURE_MESSAGE);
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
    linkCount,
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
