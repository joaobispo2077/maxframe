import type { ReactElement } from 'react';
import type { SummaryCounts } from '@src/domain/download-queue/model.js';

import { Badge, HStack, Text } from '@chakra-ui/react';

type QueueSummaryBarProps = {
  counts: SummaryCounts;
};

function CountChip({
  label,
  value,
}: {
  label: string;
  value: number;
}): ReactElement {
  return (
    <Badge variant="outline" colorPalette="gray" size="sm">
      {label}: {value}
    </Badge>
  );
}

export function QueueSummaryBar({ counts }: QueueSummaryBarProps) {
  const totalActive =
    counts.pendingAnalyze +
    counts.awaitingFormat +
    counts.queuedReady +
    counts.downloading +
    counts.postProcessing;
  const totalHistory =
    counts.historyComplete +
    counts.historyFailed +
    counts.historyCancelled;

  return (
    <HStack gap={2} flexWrap="wrap" align="center">
      <Text textStyle="queueMeta" fontWeight="medium">
        Queue
      </Text>
      {totalActive === 0 && totalHistory === 0 ? (
        <Text textStyle="queueMeta">
          Use Add to queue above to build a batch.
        </Text>
      ) : (
        <>
          <CountChip label="Analyze" value={counts.pendingAnalyze} />
          <CountChip label="Format" value={counts.awaitingFormat} />
          <CountChip label="Ready" value={counts.queuedReady} />
          <CountChip label="Downloading" value={counts.downloading} />
          <CountChip label="Post-process" value={counts.postProcessing} />
          <CountChip label="Done" value={counts.historyComplete} />
          <CountChip label="Failed" value={counts.historyFailed} />
          <CountChip label="Cancelled" value={counts.historyCancelled} />
        </>
      )}
    </HStack>
  );
}
