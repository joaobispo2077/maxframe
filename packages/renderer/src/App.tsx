import { useState } from 'react';
import maxframeLogo from '../../../.github/assets/maxframe-logo.png';

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

import {
  describeQualityAgainstBest,
  formatAudioBitrateKbps,
  formatVideoBitrateKbps,
  streamKindLabel,
} from './qualityTransparency.js';

type AnalyzeResult = Awaited<
  ReturnType<(typeof window)['maxframeApi']['analyzeVideoUrl']>
>;

function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [downloadFormatId, setDownloadFormatId] = useState<string>();
  const [error, setError] = useState<string>();
  const [downloadNote, setDownloadNote] = useState<string>();
  const [result, setResult] = useState<AnalyzeResult>();
  const [hoveredFormatId, setHoveredFormatId] = useState<string | null>(null);

  async function analyzeUrl(): Promise<void> {
    setLoading(true);
    setError(undefined);
    setDownloadNote(undefined);
    setHoveredFormatId(null);

    try {
      const analysis = await window.maxframeApi.analyzeVideoUrl(url);
      setResult(analysis);
    } catch (caughtError) {
      setResult(undefined);
      setError(
        caughtError instanceof Error ? caughtError.message : 'Unknown error',
      );
    } finally {
      setLoading(false);
    }
  }

  async function downloadQuality(formatId: string, hasAudio: boolean): Promise<void> {
    if (!result) {
      return;
    }
    setDownloadFormatId(formatId);
    setError(undefined);
    setDownloadNote(undefined);
    try {
      const { outputPath } = await window.maxframeApi.downloadVideo({
        url: result.url,
        formatId,
        hasAudio,
        suggestedFileName: `${result.videoId ?? 'video'}-${formatId}.mp4`,
      });
      setDownloadNote(`Saved to ${outputPath}`);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : 'Unknown error',
      );
    } finally {
      setDownloadFormatId(undefined);
    }
  }

  const downloadBusy = Boolean(downloadFormatId);

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
                <Text fontSize="lg" color="fg.muted">
                  Paste your URL below and check the Quality available
                </Text>
              </VStack>

              <Stack gap={4}>
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
              </Stack>

              {error ? (
                <Text role="alert" color="red.300">
                  {error}
                </Text>
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
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => setDownloadNote(undefined)}
                    aria-label="Dismiss save message"
                  >
                    Dismiss
                  </Button>
                </HStack>
              ) : null}

              {result ? (
                <Box
                  as="section"
                  aria-label="quality-results"
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
                          Qualities are whatever <Text as="strong" color="fg">yt-dlp</Text>{' '}
                          reports for this URL at analyze time—not every option YouTube may
                          show in other apps or on the web. The highlighted{' '}
                          <Text as="strong" color="fg">
                            Ranked #1
                          </Text>{' '}
                          row is the best option in this app using height, then frame rate,
                          then listed video bitrate. This is not a legal guarantee of
                          “maximum” quality everywhere; it is the top entry in this list
                          only.
                        </Text>
                        <Text>
                          If a row is <Text as="strong" color="fg">video only</Text>,
                          downloading it asks yt-dlp to merge in the best separate audio when
                          possible (same as many CLI workflows). That path needs{' '}
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
                    <Text mt={4} textAlign="center" fontSize="sm" color="orange.300">
                      Video ID could not be parsed from this URL; confirm the link uses a
                      standard watch, shorts, embed, or youtu.be shape.
                    </Text>
                  )}
                  {result.bestQuality ? (
                    <Text mt={2} textAlign="center" fontSize="sm">
                      Best raw quality: {result.bestQuality.resolutionLabel} @{' '}
                      {result.bestQuality.fps}fps ({result.bestQuality.container})
                    </Text>
                  ) : (
                    <Text mt={2} textAlign="center" fontSize="sm" color="fg.muted">
                      No downloadable video quality available for this URL.
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
                    {result.qualities.map((quality) => {
                      const isBest = result.bestQuality?.formatId === quality.formatId;
                      const videoBr = formatVideoBitrateKbps(quality.videoBitrateKbps);
                      const audioBr = formatAudioBitrateKbps(quality.audioBitrateKbps);
                      const showCompare =
                        hoveredFormatId === quality.formatId ||
                        downloadFormatId === quality.formatId;
                      return (
                        <Box as="li" key={quality.formatId}>
                          <Box
                            role="group"
                            tabIndex={0}
                            p={3}
                            borderRadius="md"
                            borderWidth="1px"
                            borderColor={isBest ? 'green.600' : 'whiteAlpha.200'}
                            bg={isBest ? 'rgba(56, 161, 105, 0.12)' : 'blackAlpha.400'}
                            outline="none"
                            _focusVisible={{
                              boxShadow: '0 0 0 2px #00f0ff',
                            }}
                            _hover={{
                              borderColor: isBest ? 'green.400' : 'cyan.500',
                            }}
                            onMouseEnter={() => setHoveredFormatId(quality.formatId)}
                            onMouseLeave={() => setHoveredFormatId(null)}
                            onFocus={() => setHoveredFormatId(quality.formatId)}
                            onBlur={(event) => {
                              if (!event.currentTarget.contains(event.relatedTarget)) {
                                setHoveredFormatId(null);
                              }
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' && !downloadBusy && !loading) {
                                event.preventDefault();
                                void downloadQuality(quality.formatId, quality.hasAudio);
                              }
                            }}
                          >
                            <HStack gap={2} flexWrap="wrap" align="baseline">
                              <Text fontWeight="bold">
                                {quality.resolutionLabel} @ {quality.fps}fps (
                                {quality.container}) — format {quality.formatId}
                              </Text>
                              {isBest ? (
                                <Badge colorPalette="green" variant="solid" size="sm">
                                  Ranked #1 (app)
                                </Badge>
                              ) : null}
                            </HStack>
                            <Text fontSize="sm" color="fg.muted" mt={2}>
                              {streamKindLabel(quality)}
                              {videoBr ? ` · ${videoBr}` : ''}
                              {audioBr ? ` · ${audioBr}` : ''}
                            </Text>
                            {showCompare ? (
                              <Text fontSize="xs" color="fg.muted" fontStyle="italic" mt={2} aria-live="polite">
                                {describeQualityAgainstBest(quality, result.bestQuality)}
                              </Text>
                            ) : null}
                            <Box mt={3}>
                              <Button
                                size="sm"
                                colorPalette="cyan"
                                variant="outline"
                                onClick={() =>
                                  void downloadQuality(quality.formatId, quality.hasAudio)
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
