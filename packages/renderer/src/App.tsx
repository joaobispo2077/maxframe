import { useEffect, useState } from 'react';

import {
  Badge,
  Box,
  Button,
  Card,
  Collapsible,
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

import { AnalyzingIndicator } from './components/AnalyzingIndicator.js';
import { DiagnosticBlock } from './components/DiagnosticBlock.js';
import { DownloadProgressCard } from './components/DownloadProgressCard.js';
import { useDownloadProgress } from './hooks/useDownloadProgress.js';
import { buildDiagnosticReport } from './lib/buildDiagnosticReport.js';
import {
  describeQualityAgainstBest,
  formatAudioBitrateKbps,
  formatVideoBitrateKbps,
  streamKindLabel,
} from './lib/qualityTransparency.js';
import { SettingsPage } from './pages/SettingsPage.js';
import type { DiagnosticsReport } from './maxframe-api.js';

type AnalyzeResult = Awaited<
  ReturnType<(typeof window)['maxframeApi']['analyzeVideoUrl']>
>;

type Mp3FallbackCardProps = {
  isDownloading: boolean;
  isDisabled: boolean;
  onDownload: () => void;
};

function deduplicateByResolution(
  qualities: AnalyzeResult['qualities'],
): AnalyzeResult['qualities'] {
  const seen = new Set<string>();
  return qualities.filter((q) => {
    const key = `${q.height}x${q.fps}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function Mp3FallbackCard({
  isDownloading,
  isDisabled,
  onDownload,
}: Mp3FallbackCardProps) {
  return (
    <Box as="li">
      <Box
        p={3}
        borderRadius="md"
        borderWidth="1px"
        borderColor="orange.700"
        bg="rgba(236, 153, 75, 0.08)"
      >
        <HStack gap={2} flexWrap="wrap" align="baseline">
          <Text fontWeight="bold">
            Best available (audio extracted from video)
          </Text>
          <Badge colorPalette="orange" variant="solid" size="sm">
            No separate audio stream
          </Badge>
        </HStack>
        <Text fontSize="sm" color="fg.muted" mt={2}>
          This video has no separate audio-only streams. yt-dlp will use{' '}
          <Text as="strong" color="fg">
            bestaudio/best
          </Text>{' '}
          to extract audio from the best available muxed stream. Requires{' '}
          <Text as="strong" color="fg">
            ffmpeg
          </Text>
          .
        </Text>
        <Box mt={3}>
          <Button
            size="sm"
            colorPalette="cyan"
            variant="outline"
            onClick={onDownload}
            disabled={isDisabled}
            loading={isDownloading}
            loadingText="Downloading…"
          >
            Download as MP3
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

function App() {
  const [activeView, setActiveView] = useState<'home' | 'settings'>('home');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [downloadFormatId, setDownloadFormatId] = useState<string>();
  const [error, setError] = useState<string>();
  const [downloadNote, setDownloadNote] = useState<string>();
  const [savedPath, setSavedPath] = useState<string>();
  const [result, setResult] = useState<AnalyzeResult>();
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

  const displayQualities =
    outputMode === 'mp3'
      ? (result?.audioQualities ?? [])
      : deduplicateByResolution(result?.qualities ?? []);
  const displayBest =
    outputMode === 'mp3' ? result?.bestAudioQuality : result?.bestQuality;
  const mp3FallbackNeeded =
    outputMode === 'mp3' &&
    result !== undefined &&
    (result.audioQualities ?? []).length === 0 &&
    result.qualities.length > 0;
  const fallbackFormatId = result?.bestQuality?.formatId ?? 'bestaudio';

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

              {error ? (
                <Text role="alert" color="red.300">
                  {error}
                </Text>
              ) : null}

              {error && debugMode && diagnosticsReport ? (
                <DiagnosticBlock
                  report={diagnosticsReport}
                  onCopy={handleCopyReport}
                  copied={reportCopied}
                />
              ) : null}

              {downloadNote ? (
                <HStack
                  role="status"
                  justify="space-between"
                  gap={3}
                  p={3}
                  borderRadius="md"
                  bg="blackAlpha.500"
                  borderWidth="1px"
                  borderColor="green.700"
                >
                  <Text fontSize="sm" flex="1">
                    {downloadNote}
                  </Text>
                  <HStack gap={1}>
                    {savedPath ? (
                      <Button
                        size="xs"
                        variant="ghost"
                        colorPalette="cyan"
                        onClick={() =>
                          void window.maxframeApi.showItemInFolder(savedPath)
                        }
                        aria-label="Open containing folder"
                      >
                        Open folder
                      </Button>
                    ) : null}
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => {
                        setDownloadNote(undefined);
                        setSavedPath(undefined);
                      }}
                      aria-label="Dismiss save message"
                    >
                      Dismiss
                    </Button>
                  </HStack>
                </HStack>
              ) : null}

              {downloadBusy ? (
                <Box
                  css={{
                    '@keyframes fadeSlideIn': {
                      from: { opacity: 0, transform: 'translateY(-6px)' },
                      to: { opacity: 1, transform: 'translateY(0)' },
                    },
                    animation: 'fadeSlideIn 0.25s ease',
                  }}
                >
                  <DownloadProgressCard
                    progress={progress}
                    onCancel={() => void cancelActiveDownload()}
                  />
                </Box>
              ) : null}

              {result ? (
                <Box
                  as="section"
                  aria-label="quality-results"
                  css={{
                    '@keyframes slideUp': {
                      from: { opacity: 0, transform: 'translateY(16px)' },
                      to: { opacity: 1, transform: 'translateY(0)' },
                    },
                    animation: 'slideUp 0.3s ease',
                  }}
                  aria-busy={downloadBusy}
                  borderTopWidth="1px"
                  borderColor="whiteAlpha.200"
                  pt={6}
                >
                  <Heading size="md" textAlign="center" mb={4}>
                    Available quality
                  </Heading>

                  <Collapsible.Root defaultOpen>
                    <Collapsible.Trigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        w="100%"
                        justifyContent="flex-start"
                        borderColor="whiteAlpha.300"
                        _hover={{ borderColor: 'cyan.400' }}
                      >
                        What this list shows
                      </Button>
                    </Collapsible.Trigger>
                    <Collapsible.Content>
                      <VStack
                        gap={3}
                        align="stretch"
                        mt={3}
                        p={3}
                        borderRadius="md"
                        bg="blackAlpha.400"
                        fontSize="sm"
                        lineHeight="tall"
                        color="fg.muted"
                      >
                        <Text>
                          Qualities are whatever{' '}
                          <Text as="strong" color="fg">
                            yt-dlp
                          </Text>{' '}
                          reports for this URL at analyze time—not every option
                          YouTube may show in other apps or on the web. The
                          highlighted{' '}
                          <Text as="strong" color="fg">
                            Ranked #1
                          </Text>{' '}
                          row is the best option in this app using height, then
                          frame rate, then listed video bitrate. This is not a
                          legal guarantee of "maximum" quality everywhere; it is
                          the top entry in this list only.
                        </Text>
                        <Text>
                          If a row is{' '}
                          <Text as="strong" color="fg">
                            video only
                          </Text>
                          , downloading it asks yt-dlp to merge in the best
                          separate audio when possible (same as many CLI
                          workflows). That path needs{' '}
                          <Text as="strong" color="fg">
                            ffmpeg
                          </Text>{' '}
                          installed.
                        </Text>
                      </VStack>
                    </Collapsible.Content>
                  </Collapsible.Root>

                  {result.videoId ? (
                    <Text mt={4} textAlign="center" fontSize="sm">
                      Video ID: {result.videoId}
                    </Text>
                  ) : (
                    <Text
                      mt={4}
                      textAlign="center"
                      fontSize="sm"
                      color="orange.300"
                    >
                      Video ID could not be parsed from this URL; confirm the
                      link uses a standard watch, shorts, embed, or youtu.be
                      shape.
                    </Text>
                  )}

                  {outputMode === 'mp4' ? (
                    result.bestQuality ? (
                      <Text mt={2} textAlign="center" fontSize="sm">
                        Best raw quality: {result.bestQuality.resolutionLabel} @{' '}
                        {result.bestQuality.fps}fps (
                        {result.bestQuality.container})
                      </Text>
                    ) : (
                      <Text
                        mt={2}
                        textAlign="center"
                        fontSize="sm"
                        color="fg.muted"
                      >
                        No downloadable video quality available for this URL.
                      </Text>
                    )
                  ) : result.bestAudioQuality ? (
                    <Text mt={2} textAlign="center" fontSize="sm">
                      Best audio quality:{' '}
                      {result.bestAudioQuality.audioBitrateKbps ?? '?'}kbps (
                      {result.bestAudioQuality.container})
                    </Text>
                  ) : mp3FallbackNeeded ? (
                    <Text
                      mt={2}
                      textAlign="center"
                      fontSize="sm"
                      color="orange.300"
                    >
                      No separate audio streams — audio will be extracted from
                      the best available video stream.
                    </Text>
                  ) : (
                    <Text
                      mt={2}
                      textAlign="center"
                      fontSize="sm"
                      color="fg.muted"
                    >
                      No downloadable audio quality available for this URL.
                    </Text>
                  )}

                  <Stack
                    as="ul"
                    role="list"
                    gap={3}
                    listStyleType="none"
                    m={0}
                    mt={4}
                    p={0}
                  >
                    {displayQualities.map((quality) => {
                      const isBest = displayBest?.formatId === quality.formatId;
                      const videoBr = quality.hasVideo
                        ? formatVideoBitrateKbps(quality.videoBitrateKbps)
                        : undefined;
                      const audioBr = formatAudioBitrateKbps(
                        quality.audioBitrateKbps,
                      );
                      const showCompare =
                        hoveredFormatId === quality.formatId ||
                        downloadFormatId === quality.formatId;
                      const qualityLabel = quality.hasVideo
                        ? `${quality.resolutionLabel} @ ${quality.fps}fps`
                        : `${quality.audioBitrateKbps ?? '?'}kbps`;
                      return (
                        <Box as="li" key={quality.formatId}>
                          <Box
                            role="group"
                            tabIndex={0}
                            p={3}
                            borderRadius="md"
                            borderWidth="1px"
                            borderColor={
                              isBest ? 'green.600' : 'whiteAlpha.200'
                            }
                            bg={
                              isBest
                                ? 'rgba(56, 161, 105, 0.12)'
                                : 'blackAlpha.400'
                            }
                            outline="none"
                            _focusVisible={{
                              boxShadow: '0 0 0 2px #00f0ff',
                            }}
                            _hover={{
                              borderColor: isBest ? 'green.400' : 'cyan.500',
                            }}
                            onMouseEnter={() =>
                              setHoveredFormatId(quality.formatId)
                            }
                            onMouseLeave={() => setHoveredFormatId(null)}
                            onFocus={() => setHoveredFormatId(quality.formatId)}
                            onBlur={(event) => {
                              if (
                                !event.currentTarget.contains(
                                  event.relatedTarget,
                                )
                              ) {
                                setHoveredFormatId(null);
                              }
                            }}
                            onKeyDown={(event) => {
                              if (
                                event.key === 'Enter' &&
                                !downloadBusy &&
                                !loading
                              ) {
                                event.preventDefault();
                                void downloadQuality(
                                  quality.formatId,
                                  quality.hasAudio,
                                );
                              }
                            }}
                          >
                            <HStack gap={2} flexWrap="wrap" align="baseline">
                              <Text fontWeight="bold">{qualityLabel}</Text>
                              {isBest ? (
                                <Badge
                                  colorPalette="green"
                                  variant="solid"
                                  size="sm"
                                >
                                  Ranked #1 (app)
                                </Badge>
                              ) : null}
                            </HStack>
                            <Text fontSize="sm" color="fg.muted" mt={2}>
                              {streamKindLabel(quality)}
                              {videoBr ? ` · ${videoBr}` : ''}
                              {audioBr ? ` · ${audioBr}` : ''}
                            </Text>
                            {showCompare && quality.hasVideo ? (
                              <Text
                                fontSize="xs"
                                color="fg.muted"
                                fontStyle="italic"
                                mt={2}
                                aria-live="polite"
                              >
                                {describeQualityAgainstBest(
                                  quality,
                                  result.bestQuality,
                                )}
                              </Text>
                            ) : null}
                            <Box mt={3}>
                              <Button
                                size="sm"
                                colorPalette="cyan"
                                variant="outline"
                                onClick={() =>
                                  void downloadQuality(
                                    quality.formatId,
                                    quality.hasAudio,
                                  )
                                }
                                disabled={downloadBusy || loading}
                                loading={downloadFormatId === quality.formatId}
                                loadingText="Downloading…"
                              >
                                Download
                              </Button>
                            </Box>
                          </Box>
                        </Box>
                      );
                    })}
                    {mp3FallbackNeeded ? (
                      <Mp3FallbackCard
                        isDownloading={downloadFormatId === fallbackFormatId}
                        isDisabled={downloadBusy || loading}
                        onDownload={() =>
                          void downloadQuality(fallbackFormatId, true)
                        }
                      />
                    ) : null}
                  </Stack>
                </Box>
              ) : null}
            </VStack>
          </Card.Body>
        </Card.Root>
      </Container>
    </Box>
  );
}

export default App;
