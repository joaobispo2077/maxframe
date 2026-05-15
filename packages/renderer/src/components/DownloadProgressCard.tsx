import type { DownloadProgressState } from '../hooks/useDownloadProgress.js';

import {
  Badge,
  Box,
  Button,
  HStack,
  Progress,
  Text,
  VStack,
} from '@chakra-ui/react';

type DownloadProgressCardProps = {
  progress: DownloadProgressState;
  onCancel: () => void;
};

const STAGE_LABELS: Record<DownloadProgressState['stage'], string> = {
  waiting: 'Starting…',
  downloading: 'Downloading',
  'extracting-audio': 'Extracting audio',
  merging: 'Merging',
  done: 'Done',
};

const STAGE_COLORS: Record<DownloadProgressState['stage'], string> = {
  waiting: 'gray',
  downloading: 'cyan',
  'extracting-audio': 'orange',
  merging: 'purple',
  done: 'green',
};

const STAGE_STATUS_FALLBACK: Record<DownloadProgressState['stage'], string> = {
  waiting: 'Waiting for yt-dlp…',
  downloading: 'Downloading…',
  'extracting-audio': 'Extracting audio…',
  merging: 'Processing with ffmpeg…',
  done: 'Complete',
};

export function DownloadProgressCard({
  progress,
  onCancel,
}: DownloadProgressCardProps) {
  const { percent, speedLabel, etaLabel, sizeLabel, stage } = progress;
  const stageLabel = STAGE_LABELS[stage];
  const stageColor = STAGE_COLORS[stage];

  const statsLine =
    [
      speedLabel && `${speedLabel}`,
      etaLabel && etaLabel !== 'done' && `ETA ${etaLabel}`,
      sizeLabel && sizeLabel,
    ]
      .filter(Boolean)
      .join(' · ') || STAGE_STATUS_FALLBACK[stage];

  return (
    <Box
      p={3}
      borderRadius="md"
      bg="blackAlpha.500"
      borderWidth="1px"
      borderColor="whiteAlpha.200"
    >
      <HStack justify="space-between" gap={3} mb={3} align="center">
        <HStack gap={2} align="center">
          <Text fontSize="sm" fontWeight="medium">
            Download in progress
          </Text>
          <Badge colorPalette={stageColor} variant="solid" size="sm">
            {stageLabel}
          </Badge>
        </HStack>
        <Button
          type="button"
          size="sm"
          variant="outline"
          colorPalette="red"
          data-testid="download-cancel-btn"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </HStack>

      <VStack gap={2} align="stretch">
        <Progress.Root
          value={
            stage === 'waiting' || (stage === 'merging' && percent <= 0)
              ? undefined
              : percent
          }
          max={100}
          size="sm"
          colorPalette={stageColor}
        >
          <Progress.Track borderRadius="full">
            <Progress.Range style={{ transition: 'width 0.6s ease' }} />
          </Progress.Track>
        </Progress.Root>

        <HStack justify="space-between" gap={2}>
          <Text fontSize="xs" color="fg.muted" aria-live="polite">
            {statsLine}
          </Text>
          <Text fontSize="xs" fontWeight="medium" color="fg">
            {stage === 'waiting' ? '0%' : `${percent.toFixed(0)}%`}
          </Text>
        </HStack>
      </VStack>
    </Box>
  );
}
