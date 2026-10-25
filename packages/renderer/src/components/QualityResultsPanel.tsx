import type { AnalyzeVideoResult } from '../lib/analyzeVideoResultType.js';

import {
  Badge,
  Box,
  Button,
  Collapsible,
  Heading,
  HStack,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react';

import { slideUpRevealStyles } from '../theme/motionStyles.js';

import { QualityResultRow } from './QualityResultRow.js';

function deduplicateByResolution(
  qualities: AnalyzeVideoResult['qualities'],
): AnalyzeVideoResult['qualities'] {
  const seen = new Set<string>();
  return qualities.filter((q) => {
    const key = `${q.height}x${q.fps}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

type Mp3FallbackCardProps = {
  isDownloading: boolean;
  isDisabled: boolean;
  onDownload: () => void;
};

function Mp3FallbackCard({
  isDownloading,
  isDisabled,
  onDownload,
}: Mp3FallbackCardProps) {
  const rowStatus = isDownloading ? 'downloading' : 'ready';
  return (
    <Box as="li" data-testid="quality-row-mp3-fallback">
      <Box
        data-testid="quality-row-status-mp3-fallback"
        data-status={rowStatus}
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
            colorPalette="purple"
            variant="outline"
            data-testid="quality-download-mp3-fallback"
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

function QualityListExplainer() {
  return (
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
            These are the qualities yt-dlp found for this link. The top pick has
            the highest resolution, then frame rate, then bitrate. YouTube may
            offer other options in other apps.
          </Text>
        </VStack>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

function VideoIdLine({ videoId }: { videoId: string | undefined }) {
  if (videoId) {
    return (
      <Text mt={4} textAlign="center" fontSize="sm">
        Video ID: {videoId}
      </Text>
    );
  }
  return (
    <Text mt={4} textAlign="center" fontSize="sm" color="orange.300">
      Couldn&apos;t read a video ID from this link. Use a youtube.com/watch,
      /shorts, /embed, or youtu.be link.
    </Text>
  );
}

function AnalyzeBestSummary({
  outputMode,
  result,
  mp3FallbackNeeded,
}: {
  outputMode: 'mp3' | 'mp4';
  result: AnalyzeVideoResult;
  mp3FallbackNeeded: boolean;
}) {
  if (outputMode === 'mp4') {
    if (result.bestQuality) {
      return (
        <Text mt={2} textAlign="center" fontSize="sm">
          Best video: {result.bestQuality.resolutionLabel} @{' '}
          {result.bestQuality.fps}fps ({result.bestQuality.container})
        </Text>
      );
    }
    return (
      <Text mt={2} textAlign="center" fontSize="sm" color="fg.muted">
        No downloadable video quality available for this URL.
      </Text>
    );
  }

  if (result.bestAudioQuality) {
    return (
      <Text mt={2} textAlign="center" fontSize="sm">
        Best audio quality: {result.bestAudioQuality.audioBitrateKbps ?? '?'}
        kbps ({result.bestAudioQuality.container})
      </Text>
    );
  }

  if (mp3FallbackNeeded) {
    return (
      <Text mt={2} textAlign="center" fontSize="sm" color="orange.300">
        No separate audio streams. Audio will be extracted from the best
        available video stream.
      </Text>
    );
  }

  return (
    <Text mt={2} textAlign="center" fontSize="sm" color="fg.muted">
      No downloadable audio quality available for this URL.
    </Text>
  );
}

export type QualityResultsPanelProps = {
  result: AnalyzeVideoResult;
  outputMode: 'mp3' | 'mp4';
  downloadBusy: boolean;
  loading: boolean;
  hoveredFormatId: string | null;
  downloadFormatId: string | undefined;
  onHoverChange: (formatId: string | null) => void;
  onDownloadQuality: (formatId: string, hasAudio: boolean) => void;
};

export function QualityResultsPanel({
  result,
  outputMode,
  downloadBusy,
  loading,
  hoveredFormatId,
  downloadFormatId,
  onHoverChange,
  onDownloadQuality,
}: QualityResultsPanelProps) {
  const displayQualities =
    outputMode === 'mp3'
      ? (result.audioQualities ?? [])
      : deduplicateByResolution(result.qualities ?? []);
  const displayBest =
    outputMode === 'mp3' ? result.bestAudioQuality : result.bestQuality;
  const mp3FallbackNeeded =
    outputMode === 'mp3' &&
    (result.audioQualities ?? []).length === 0 &&
    result.qualities.length > 0;
  const fallbackFormatId = result.bestQuality?.formatId ?? 'bestaudio';

  return (
    <Box
      as="section"
      aria-label="quality-results"
      css={slideUpRevealStyles}
      aria-busy={downloadBusy}
      borderTopWidth="1px"
      borderColor="whiteAlpha.200"
      pt={6}
    >
      <Heading size="md" textAlign="center" mb={4}>
        Available qualities
      </Heading>

      <QualityListExplainer />

      <VideoIdLine videoId={result.videoId} />

      <AnalyzeBestSummary
        outputMode={outputMode}
        result={result}
        mp3FallbackNeeded={mp3FallbackNeeded}
      />

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
          const showCompare =
            hoveredFormatId === quality.formatId ||
            downloadFormatId === quality.formatId;
          return (
            <QualityResultRow
              key={quality.formatId}
              quality={quality}
              isBest={isBest}
              bestQuality={result.bestQuality}
              showCompare={showCompare}
              downloadBusy={downloadBusy}
              loading={loading}
              downloadFormatId={downloadFormatId}
              onHoverChange={onHoverChange}
              onDownload={onDownloadQuality}
            />
          );
        })}
        {mp3FallbackNeeded ? (
          <Mp3FallbackCard
            isDownloading={downloadFormatId === fallbackFormatId}
            isDisabled={downloadBusy || loading}
            onDownload={() => void onDownloadQuality(fallbackFormatId, true)}
          />
        ) : null}
      </Stack>
    </Box>
  );
}
