import type { AnalyzeVideoResult } from './lib/analyzeVideoResultType.js';
import type { DiagnosticsReport } from './maxframe-api.js';

import { useEffect, useState } from 'react';

import {
  Badge,
  Box,
  Button,
  Card,
  Container,
  Field,
  Heading,
  HStack,
  Image,
  Input,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react';

import maxframeLogo from '../../../.github/assets/maxframe-logo.png';

import { ActiveDownloadPanel } from './components/ActiveDownloadPanel.js';
import { AnalyzeErrorBanner } from './components/AnalyzeErrorBanner.js';
import { AnalyzingIndicator } from './components/AnalyzingIndicator.js';
import { QualityResultsPanel } from './components/QualityResultsPanel.js';
import { SaveMessageBanner } from './components/SaveMessageBanner.js';
import { useDownloadProgress } from './hooks/useDownloadProgress.js';
import { buildDiagnosticReport } from './lib/buildDiagnosticReport.js';
import { SettingsPage } from './pages/SettingsPage.js';

function App() {
  const [activeView, setActiveView] = useState<'home' | 'settings'>('home');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [downloadFormatId, setDownloadFormatId] = useState<string>();
  const [error, setError] = useState<string>();
  const [downloadNote, setDownloadNote] = useState<string>();
  const [savedPath, setSavedPath] = useState<string>();
  const [result, setResult] = useState<AnalyzeVideoResult>();
  const [hoveredFormatId, setHoveredFormatId] = useState<string | null>(null);
  const [outputMode, setOutputMode] = useState<'mp3' | 'mp4'>('mp4');
  const { progress, clear: clearDownloadProgress } = useDownloadProgress();

  const [isPortable, setIsPortable] = useState(false);

  useEffect(() => {
    window.maxframeApi
      ?.getInitialAppState?.()
      .then((s) => setIsPortable(s.isPortable ?? false))
      .catch(() => {});
  }, []);

  const [debugMode] = useState(
    () => localStorage.getItem('maxframe.debugMode') === 'true',
  );
  const [diagnosticsReport, setDiagnosticsReport] = useState<
    DiagnosticsReport | undefined
  >();
  const [reportCopied, setReportCopied] = useState(false);

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
    setLoading(true);
    setError(undefined);
    setDownloadNote(undefined);
    setSavedPath(undefined);
    setHoveredFormatId(null);
    setDiagnosticsReport(undefined);
    setReportCopied(false);

    try {
      const analysis = await window.maxframeApi.analyzeVideoUrl(url);
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
    setDownloadFormatId(formatId);
    clearDownloadProgress();
    setError(undefined);
    setDownloadNote(undefined);
    setSavedPath(undefined);
    setDiagnosticsReport(undefined);
    setReportCopied(false);
    try {
      const clean = (s: string) =>
        s
          .replace(/[\\/:*?"<>|]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      const safeTitle = clean(result.title || result.videoId || 'video');
      const safeUploader = clean(result.uploader) || 'Unknown Channel';
      const stem = `${safeTitle} - ${safeUploader}`.slice(0, 200).trimEnd();
      const suggestedFileName = `${stem}.${outputMode}`;
      const { outputPath } = await window.maxframeApi.downloadVideo({
        url: result.url,
        formatId,
        hasAudio,
        suggestedFileName,
        outputMode,
      });
      setDownloadNote(`Saved to ${outputPath}`);
      setSavedPath(outputPath);
    } catch (caughtError) {
      const msg =
        caughtError instanceof Error ? caughtError.message : 'Unknown error';
      if (msg === 'Download canceled.') {
        setError(undefined);
        setDownloadNote(undefined);
      } else {
        setError(msg);
        if (debugMode) {
          void fetchDiagnostics();
        }
      }
    } finally {
      setDownloadFormatId(undefined);
      clearDownloadProgress();
    }
  }

  const downloadBusy = Boolean(downloadFormatId);

  if (activeView === 'settings') {
    return <SettingsPage onBack={() => setActiveView('home')} />;
  }

  return (
    <Box minH="100vh" py={{ base: 6, md: 10 }} px={4}>
      <Container maxW="720px">
        <Card.Root
          bg="#0f141c"
          borderWidth="1px"
          borderColor="rgba(0, 240, 255, 0.22)"
          boxShadow="0 0 40px rgba(0, 240, 255, 0.06)"
          borderRadius="xl"
        >
          <Card.Body>
            <VStack gap={6} align="stretch">
              <VStack gap={3} textAlign="center">
                <Image
                  src={maxframeLogo}
                  alt="Maxframe logo"
                  boxSize="96px"
                  mx="auto"
                  objectFit="contain"
                />
                <Heading size="xl" letterSpacing="tight">
                  Maxframe
                </Heading>
                {isPortable && (
                  <Badge colorPalette="cyan" variant="subtle" size="sm">
                    Portable
                  </Badge>
                )}
                <Text fontSize="lg" color="fg.muted">
                  Paste your URL below and check the Quality available
                </Text>
                <HStack justify="flex-end" w="100%">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    colorPalette="cyan"
                    onClick={() => setActiveView('settings')}
                  >
                    Settings
                  </Button>
                </HStack>
              </VStack>

              <Stack gap={4}>
                <Field.Root>
                  <Field.Label htmlFor="output-format">
                    Output format
                  </Field.Label>
                  <select
                    id="output-format"
                    value={outputMode}
                    onChange={(e) =>
                      setOutputMode(e.target.value as 'mp3' | 'mp4')
                    }
                    style={{
                      background: 'rgba(0,0,0,0.4)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '6px',
                      color: 'white',
                      padding: '8px 12px',
                      width: '100%',
                      fontSize: '14px',
                    }}
                  >
                    <option value="mp4">MP4 (best video)</option>
                    <option value="mp3">MP3 (best audio)</option>
                  </select>
                </Field.Root>
                <Field.Root>
                  <Field.Label htmlFor="youtube-url">YouTube URL</Field.Label>
                  <Input
                    id="youtube-url"
                    type="url"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    bg="blackAlpha.400"
                    borderColor="panelBorder"
                    _focusVisible={{
                      borderColor: 'cyan.400',
                      boxShadow: '0 0 0 1px #00f0ff',
                    }}
                  />
                </Field.Root>
                <Button
                  colorPalette="cyan"
                  variant="surface"
                  onClick={() => void analyzeUrl()}
                  disabled={!url || loading || downloadBusy}
                  loading={loading}
                  loadingText="Analyzing..."
                  alignSelf={{ base: 'stretch', sm: 'flex-start' }}
                >
                  Analyze quality
                </Button>
                <AnalyzingIndicator visible={loading} />
              </Stack>

              <AnalyzeErrorBanner
                error={error}
                debugMode={debugMode}
                diagnosticsReport={diagnosticsReport}
                onCopyReport={handleCopyReport}
                reportCopied={reportCopied}
              />

              <SaveMessageBanner
                downloadNote={downloadNote}
                savedPath={savedPath}
                onDismiss={() => {
                  setDownloadNote(undefined);
                  setSavedPath(undefined);
                }}
              />

              <ActiveDownloadPanel
                visible={downloadBusy}
                progress={progress}
                onCancel={() => void cancelActiveDownload()}
              />

              {result ? (
                <QualityResultsPanel
                  result={result}
                  outputMode={outputMode}
                  downloadBusy={downloadBusy}
                  loading={loading}
                  hoveredFormatId={hoveredFormatId}
                  downloadFormatId={downloadFormatId}
                  onHoverChange={setHoveredFormatId}
                  onDownloadQuality={downloadQuality}
                />
              ) : null}
            </VStack>
          </Card.Body>
        </Card.Root>
      </Container>
    </Box>
  );
}

export default App;
