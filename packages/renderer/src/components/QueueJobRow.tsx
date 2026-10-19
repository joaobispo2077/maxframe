import type { QueueJob } from '@src/domain/download-queue/model.js';

import { Box, Button, HStack, Progress, Text, VStack } from '@chakra-ui/react';

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

function showsJobProgress(job: QueueJob): boolean {
  return (
    job.phase === 'download' ||
    job.phase === 'post' ||
    job.progress.stage !== 'waiting'
  );
}

function jobStatsLine(job: QueueJob): string {
  const eta =
    job.progress.etaLabel && job.progress.etaLabel !== 'done'
      ? `ETA ${job.progress.etaLabel}`
      : '';
  return [job.progress.speedLabel, eta, job.progress.sizeLabel]
    .filter(Boolean)
    .join(' · ');
}

function progressValue(job: QueueJob): number | undefined {
  const waiting = job.progress.stage === 'waiting';
  const mergingAtZero =
    job.progress.stage === 'merging' && job.progress.percent <= 0;
  if (waiting || mergingAtZero) return undefined;
  return job.progress.percent;
}

function progressPercentLabel(job: QueueJob): string {
  if (job.progress.stage === 'waiting') return '0%';
  return `${job.progress.percent.toFixed(0)}%`;
}

function rowChrome(isActive: boolean): {
  bg: string;
  borderLeftWidth: string;
  borderLeftColor: string;
} {
  if (isActive) {
    return {
      bg: 'queue.rowActive',
      borderLeftWidth: '3px',
      borderLeftColor: 'queue.rail',
    };
  }
  return {
    bg: 'queue.panel',
    borderLeftWidth: '1px',
    borderLeftColor: 'border',
  };
}

function JobProgress({
  job,
  isActive,
}: {
  job: QueueJob;
  isActive: boolean;
}) {
  if (!showsJobProgress(job)) return null;
  return (
    <VStack gap={1} align="stretch">
      <Progress.Root
        value={progressValue(job)}
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
          {jobStatsLine(job) || '\u00a0'}
        </Text>
        <Text textStyle="queueNumeric" fontWeight="medium" color="fg">
          {progressPercentLabel(job)}
        </Text>
      </HStack>
    </VStack>
  );
}

function JobActions({
  job,
  disableMoveUp,
  disableMoveDown,
  onMoveUp,
  onMoveDown,
  onRemove,
}: Omit<QueueJobRowProps, 'isActive'>) {
  return (
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
  );
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
  const chrome = rowChrome(isActive);

  return (
    <Box
      data-testid={`queue-job-${job.id}`}
      p={3}
      borderRadius="md"
      bg={chrome.bg}
      borderWidth="1px"
      borderColor="border"
      borderLeftWidth={chrome.borderLeftWidth}
      borderLeftColor={chrome.borderLeftColor}
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

        <JobProgress job={job} isActive={isActive} />

        <JobActions
          job={job}
          disableMoveUp={disableMoveUp}
          disableMoveDown={disableMoveDown}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onRemove={onRemove}
        />
      </VStack>
    </Box>
  );
}
