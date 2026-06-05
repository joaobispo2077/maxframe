import type { QueueJob } from '@src/domain/download-queue/model.js';

import {
  Box,
  Button,
  HStack,
  Progress,
  Text,
  VStack,
} from '@chakra-ui/react';

import { QueuePhaseBadge } from './QueuePhaseBadge.js';

export type QueueJobRowProps = {
  job: QueueJob;
  isActive: boolean;
  disableMoveUp: boolean;
  disableMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
};

function primaryTitle(job: QueueJob): string {
  return job.analysis?.title ?? job.submittedUrl;
}

export function QueueJobRow({
  job,
  isActive,
  disableMoveUp,
  disableMoveDown,
  onMoveUp,
  onMoveDown,
  onRemove,
}: QueueJobRowProps) {
  const title = primaryTitle(job);
  const showProgress =
    job.phase === 'download' ||
    job.phase === 'post' ||
    job.progress.stage !== 'waiting';

  const statsLine =
    [
      job.progress.speedLabel && `${job.progress.speedLabel}`,
      job.progress.etaLabel &&
        job.progress.etaLabel !== 'done' &&
        `ETA ${job.progress.etaLabel}`,
      job.progress.sizeLabel && job.progress.sizeLabel,
    ]
      .filter(Boolean)
      .join(' · ') || '';

  return (
    <Box
      data-testid={`queue-job-${job.id}`}
      p={3}
      borderRadius="md"
      bg={isActive ? 'queue.rowActive' : 'queue.panel'}
      borderWidth="1px"
      borderColor="border"
      borderLeftWidth={isActive ? '3px' : '1px'}
      borderLeftColor={isActive ? 'queue.rail' : 'border'}
    >
      <VStack gap={2} align="stretch">
        <HStack justify="space-between" gap={3} align="flex-start">
          <VStack gap={1} align="stretch" flex={1} minW={0}>
            <Text textStyle="queueTitle" lineClamp={2} title={title}>
              {title}
            </Text>
            <Text textStyle="queueMeta" lineClamp={1} title={job.submittedUrl}>
              {job.submittedUrl}
            </Text>
          </VStack>
          <QueuePhaseBadge job={job} />
        </HStack>

        {showProgress ? (
          <VStack gap={1} align="stretch">
            <Progress.Root
              value={
                job.progress.stage === 'waiting' ||
                (job.progress.stage === 'merging' && job.progress.percent <= 0)
                  ? undefined
                  : job.progress.percent
              }
              max={100}
              size="sm"
              colorPalette={isActive ? 'cyan' : 'gray'}
            >
              <Progress.Track borderRadius="full">
                <Progress.Range style={{ transition: 'width 0.3s ease' }} />
              </Progress.Track>
            </Progress.Root>
            <HStack justify="space-between" gap={2}>
              <Text fontSize="xs" color="fg.muted" aria-live="polite">
                {statsLine || '\u00a0'}
              </Text>
              <Text
                textStyle="queueNumeric"
                fontWeight="medium"
                color="fg"
              >
                {job.progress.stage === 'waiting'
                  ? '0%'
                  : `${job.progress.percent.toFixed(0)}%`}
              </Text>
            </HStack>
          </VStack>
        ) : null}

        <HStack gap={2} justify="flex-end" flexWrap="wrap">
          <Button
            type="button"
            size="xs"
            variant="outline"
            aria-label="Move up in queue"
            disabled={disableMoveUp}
            onClick={onMoveUp}
          >
            Up
          </Button>
          <Button
            type="button"
            size="xs"
            variant="outline"
            aria-label="Move down in queue"
            disabled={disableMoveDown}
            onClick={onMoveDown}
          >
            Down
          </Button>
          <Button
            type="button"
            size="xs"
            variant="outline"
            colorPalette="red"
            aria-label="Remove from queue"
            data-testid={`queue-remove-${job.id}`}
            onClick={onRemove}
          >
            Remove
          </Button>
        </HStack>
      </VStack>
    </Box>
  );
}
