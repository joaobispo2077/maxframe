import type { ReactElement } from 'react';

import {
  canReorderJob,
  type QueueJob,
  type QueueModel,
  type SummaryCounts,
} from '@src/domain/download-queue/model.js';
import {
  Box,
  Heading,
  Separator,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react';

import { QueueHistorySection } from './QueueHistorySection.js';
import { QueueJobRow } from './QueueJobRow.js';
import { QueueSummaryBar } from './QueueSummaryBar.js';

export type DownloadQueuePanelProps = {
  model: QueueModel;
  summary: SummaryCounts;
  moveJobInQueue: (id: string, direction: 'up' | 'down') => void;
  removeJobFromQueue: (id: string) => void;
};

function sortJobs(jobs: QueueJob[]): QueueJob[] {
  return [...jobs].sort((a, b) => a.orderIndex - b.orderIndex);
}

export function DownloadQueuePanel({
  model,
  summary,
  moveJobInQueue,
  removeJobFromQueue,
}: DownloadQueuePanelProps): ReactElement {
  const ordered = sortJobs(model.jobs);

  return (
    <Box
      mt={6}
      pt={6}
      borderTopWidth="1px"
      borderTopColor="border"
    >
      <VStack gap={4} align="stretch">
        <Heading size="md">Download queue</Heading>
        <Text fontSize="sm" color="fg.muted">
          Use <strong>Add to queue</strong> above for batch URLs (one per line).
          Runner automation comes next — reorder and remove freely for now.
        </Text>
        <QueueSummaryBar counts={summary} />
        <Separator borderColor="border" />
        <Stack gap={3}>
          {ordered.length === 0 ? (
            <Text textStyle="queueMeta">No active queue items.</Text>
          ) : (
            ordered.map((job) => (
              <QueueJobRow
                key={job.id}
                job={job}
                isActive={model.activeJobId === job.id}
                disableMoveUp={!canReorderJob(model, job.id, 'up')}
                disableMoveDown={!canReorderJob(model, job.id, 'down')}
                onMoveUp={() => moveJobInQueue(job.id, 'up')}
                onMoveDown={() => moveJobInQueue(job.id, 'down')}
                onRemove={() => removeJobFromQueue(job.id)}
              />
            ))
          )}
        </Stack>
        <QueueHistorySection jobs={model.historyJobs} />
      </VStack>
    </Box>
  );
}
