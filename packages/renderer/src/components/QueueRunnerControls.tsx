import type { SummaryCounts } from '@src/domain/download-queue/model.js';

import { Button, HStack, Text } from '@chakra-ui/react';

export type QueueRunnerControlsProps = {
  running: boolean;
  canStart: boolean;
  jobCount: number;
  summary: SummaryCounts;
  onStart: () => void;
  onStop: () => void;
};

function statusLabel(
  running: boolean,
  jobCount: number,
  summary: SummaryCounts,
): string {
  if (!running) {
    return jobCount === 0
      ? 'Add URLs to the queue, then start batch processing.'
      : `${jobCount} job${jobCount === 1 ? '' : 's'} ready.`;
  }
  const active =
    summary.downloading +
    summary.postProcessing +
    summary.pendingAnalyze +
    summary.queuedReady;
  const done = summary.historyComplete + summary.historyFailed + summary.historyCancelled;
  return `Processing — ${active} active, ${done} finished this session`;
}

export function QueueRunnerControls({
  running,
  canStart,
  jobCount,
  summary,
  onStart,
  onStop,
}: QueueRunnerControlsProps) {
  return (
    <HStack gap={3} flexWrap="wrap" align="center" justify="space-between">
      <Text fontSize="sm" color="fg.muted" flex={1} minW={0}>
        {statusLabel(running, jobCount, summary)}
      </Text>
      <HStack gap={2}>
        {running ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            colorPalette="red"
            aria-label="Stop queue"
            onClick={() => void onStop()}
          >
            Stop queue
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            colorPalette="purple"
            aria-label="Start queue"
            disabled={!canStart}
            onClick={() => void onStart()}
          >
            Start queue
          </Button>
        )}
      </HStack>
    </HStack>
  );
}
