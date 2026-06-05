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

export function QueuePhaseBadge({ job }: { job: QueueJob }) {
  const label = job.status.length > 0 ? job.status : job.phase;
  return (
    <Badge colorPalette={badgePalette(job)} variant="solid" size="sm">
      {label}
    </Badge>
  );
}
