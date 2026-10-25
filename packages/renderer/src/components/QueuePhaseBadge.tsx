import type { QueueJob } from '@src/domain/download-queue/model.js';

import { Badge } from '@chakra-ui/react';

function badgePalette(job: Pick<QueueJob, 'phase' | 'terminal'>): string {
  if (job.terminal === 'failed') return 'red';
  if (job.terminal === 'complete') return 'green';
  if (job.terminal === 'cancelled') return 'gray';
  switch (job.phase) {
    case 'pre':
      return 'gray';
    case 'download':
      return 'cyan';
    case 'post':
      return 'purple';
    case 'terminal':
      return 'blue';
    default:
      return 'gray';
  }
}

function visibleStatus(status: string): string {
  if (status === 'Cancelled') return 'Canceled';
  return status;
}

export function QueuePhaseBadge({ job }: { job: QueueJob }) {
  const label = job.status.length > 0 ? visibleStatus(job.status) : job.phase;
  return (
    <Badge
      colorPalette={badgePalette(job)}
      variant="solid"
      size="sm"
      data-testid={`queue-row-status-${job.id}`}
      data-status={job.terminal ?? job.phase}
    >
      {label}
    </Badge>
  );
}
