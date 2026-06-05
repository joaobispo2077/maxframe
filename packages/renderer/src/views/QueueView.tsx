import { Text, VStack } from '@chakra-ui/react';

import { DownloadQueuePanel } from '../components/DownloadQueuePanel.js';
import type { useDownloadQueue } from '../hooks/useDownloadQueue.js';

type QueueState = ReturnType<typeof useDownloadQueue>;

type QueueViewProps = {
  queue: Pick<
    QueueState,
    'model' | 'summary' | 'moveJobInQueue' | 'removeJobFromQueue'
  >;
};

export function QueueView({ queue }: QueueViewProps) {
  const hasJobs = queue.model.jobs.length > 0;

  return (
    <VStack gap={4} align="stretch">
      {!hasJobs ? (
        <Text fontSize="sm" color="fg.muted">
          No URLs in the queue yet. Paste links on the Analyze tab and choose
          Add to queue.
        </Text>
      ) : null}
      <DownloadQueuePanel
        model={queue.model}
        summary={queue.summary}
        moveJobInQueue={queue.moveJobInQueue}
        removeJobFromQueue={queue.removeJobFromQueue}
      />
    </VStack>
  );
}
