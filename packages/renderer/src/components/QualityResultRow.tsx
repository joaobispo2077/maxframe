import type { AnalyzeVideoResult } from '../lib/analyzeVideoResultType.js';

import type { FocusEvent, KeyboardEvent } from 'react';

import { Badge, Box, Button, HStack, Text } from '@chakra-ui/react';

import {
  describeQualityAgainstBest,
  formatAudioBitrateKbps,
  formatVideoBitrateKbps,
  streamKindLabel,
} from '../lib/qualityTransparency.js';

type QualityOption = AnalyzeVideoResult['qualities'][number];

function QualityVsBestHint({
  quality,
  bestQuality,
  showCompare,
}: {
  quality: QualityOption;
  bestQuality: AnalyzeVideoResult['bestQuality'];
  showCompare: boolean;
}) {
  if (!showCompare || !quality.hasVideo) {
    return null;
  }
  return (
    <Text
      fontSize="xs"
      color="fg.muted"
      fontStyle="italic"
      mt={2}
      aria-live="polite"
    >
      {describeQualityAgainstBest(quality, bestQuality)}
    </Text>
  );
}

export type QualityResultRowProps = {
  quality: QualityOption;
  isBest: boolean;
  bestQuality: AnalyzeVideoResult['bestQuality'];
  showCompare: boolean;
  downloadBusy: boolean;
  loading: boolean;
  downloadFormatId: string | undefined;
  onHoverChange: (formatId: string | null) => void;
  onDownload: (formatId: string, hasAudio: boolean) => void;
};

export function QualityResultRow({
  quality,
  isBest,
  bestQuality,
  showCompare,
  downloadBusy,
  loading,
  downloadFormatId,
  onHoverChange,
  onDownload,
}: QualityResultRowProps) {
  const videoBr = quality.hasVideo
    ? formatVideoBitrateKbps(quality.videoBitrateKbps)
    : undefined;
  const audioBr = formatAudioBitrateKbps(quality.audioBitrateKbps);
  const qualityLabel = quality.hasVideo
    ? `${quality.resolutionLabel} @ ${quality.fps}fps`
    : `${quality.audioBitrateKbps ?? '?'}kbps`;

  function handleBlur(event: FocusEvent<HTMLDivElement>): void {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      onHoverChange(null);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key !== 'Enter' || downloadBusy || loading) {
      return;
    }
    event.preventDefault();
    void onDownload(quality.formatId, quality.hasAudio);
  }

  return (
    <Box as="li">
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
        onMouseEnter={() => onHoverChange(quality.formatId)}
        onMouseLeave={() => onHoverChange(null)}
        onFocus={() => onHoverChange(quality.formatId)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      >
        <HStack gap={2} flexWrap="wrap" align="baseline">
          <Text fontWeight="bold">{qualityLabel}</Text>
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
        <QualityVsBestHint
          quality={quality}
          bestQuality={bestQuality}
          showCompare={showCompare}
        />
        <Box mt={3}>
          <Button
            size="sm"
            colorPalette="cyan"
            variant="outline"
            onClick={() => void onDownload(quality.formatId, quality.hasAudio)}
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
}
