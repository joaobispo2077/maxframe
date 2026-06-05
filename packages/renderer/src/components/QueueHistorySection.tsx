import type { QueueJob } from '@src/domain/download-queue/model.js';

import {
  Box,
  Button,
  Collapsible,
  Heading,
  HStack,
  Text,
  VStack,
} from '@chakra-ui/react';

import { QueuePhaseBadge } from './QueuePhaseBadge.js';

export type QueueHistorySectionProps = {
  jobs: QueueJob[];
};

export function QueueHistorySection({ jobs }: QueueHistorySectionProps) {
  if (jobs.length === 0) {
    return null;
  }

  return (
    <Collapsible.Root defaultOpen={false}>
      <Collapsible.Trigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          colorPalette="cyan"
          justifyContent="flex-start"
          px={0}
        >
          History ({jobs.length})
        </Button>
      </Collapsible.Trigger>
      <Collapsible.Content>
        <VStack gap={2} align="stretch" mt={2}>
          {jobs.map((job) => (
            <Box
              key={job.id}
              p={2}
              borderRadius="md"
              borderWidth="1px"
              borderColor="border"
              bg="blackAlpha.400"
            >
              <HistoryRow job={job} />
            </Box>
          ))}
        </VStack>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

function HistoryRow({ job }: { job: QueueJob }) {
  const title = job.analysis?.title ?? job.submittedUrl;
  return (
    <VStack gap={1} align="stretch">
      <Heading size="xs" fontWeight="semibold" lineClamp={2}>
        {title}
      </Heading>
      <HStack justify="space-between" gap={2} flexWrap="wrap">
        <QueuePhaseBadge job={job} />
        {job.outputPath ? (
          <Text textStyle="queueMeta" lineClamp={1} title={job.outputPath}>
            {job.outputPath}
          </Text>
        ) : null}
      </HStack>
      {job.statusDetail ? (
        <Text textStyle="queueMeta" color="fg.muted">
          {job.statusDetail}
        </Text>
      ) : null}
    </VStack>
  );
}
