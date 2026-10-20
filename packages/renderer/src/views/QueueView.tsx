import type { useDownloadQueue } from '../hooks/useDownloadQueue.js';

import { VStack } from '@chakra-ui/react';

import { DownloadQueuePanel } from '../components/DownloadQueuePanel.js';

type QueueState = ReturnType<typeof useDownloadQueue>;

type RunnerState = {
  running: boolean;
  canStart: boolean;
  start: () => Promise<void>;
  stop: () => Promise<void>;
};

type QueueViewProps = {
  queue: Pick<
    QueueState,
    'model' | 'summary' | 'moveJobInQueue' | 'removeJobFromQueue'
  >;
  runner: RunnerState;
};

export function QueueView({ queue, runner }: QueueViewProps) {
  return (
    <VStack gap={4} align="stretch">
      <DownloadQueuePanel
        model={queue.model}
        summary={queue.summary}
        moveJobInQueue={queue.moveJobInQueue}
        removeJobFromQueue={queue.removeJobFromQueue}
        runnerRunning={runner.running}
        runnerCanStart={runner.canStart}
        onRunnerStart={() => void runner.start()}
        onRunnerStop={() => void runner.stop()}
      />
    </VStack>
  );
}
