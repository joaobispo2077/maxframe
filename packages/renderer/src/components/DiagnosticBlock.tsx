import type { DiagnosticsReport } from '../maxframe-api.js';

import { Badge, Box, Button, HStack, Text, VStack } from '@chakra-ui/react';
import { maskDiagnosticReport } from '@src/infrastructure/diagnostics/buildDiagnosticReport.js';

type DiagnosticBlockProps = {
  report: DiagnosticsReport;
  onCopy: () => void;
  copied: boolean;
};

function ToolRow({
  label,
  path,
  found,
}: {
  label: string;
  path: string;
  found: boolean;
}) {
  return (
    <HStack gap={2} align="baseline" flexWrap="wrap">
      <Text fontWeight="bold" minW="60px">
        {label}:
      </Text>
      <Text
        fontFamily="mono"
        fontSize="xs"
        color="fg.muted"
        wordBreak="break-all"
      >
        {path}
      </Text>
      <Badge
        colorPalette={found ? 'green' : 'orange'}
        variant="solid"
        size="sm"
      >
        {found ? 'Found' : 'Missing'}
      </Badge>
    </HStack>
  );
}

export function DiagnosticBlock({
  report,
  onCopy,
  copied,
}: DiagnosticBlockProps) {
  const visible = maskDiagnosticReport(report);
  const ytdlpVersion = report.ytdlpVersion ?? '(unknown)';
  const versionLine = [
    `Platform: ${report.platform} (${report.arch})`,
    `App: ${report.appVersion}`,
    `yt-dlp: ${ytdlpVersion}`,
  ].join(' · ');
  return (
    <Box
      mt={3}
      p={3}
      borderRadius="md"
      borderWidth="1px"
      borderColor="whiteAlpha.300"
      bg="blackAlpha.500"
      fontSize="sm"
    >
      <Text fontWeight="semibold" mb={3} color="orange.300">
        Diagnostic info
      </Text>
      <VStack align="stretch" gap={2}>
        <ToolRow
          label="yt-dlp"
          path={visible.ytdlpPath}
          found={report.ytdlpFound}
        />
        <ToolRow
          label="ffmpeg"
          path={visible.ffmpegPath}
          found={report.ffmpegFound}
        />
        <Text color="fg.muted" data-testid="diagnostic-versions">
          {versionLine}
        </Text>
        {visible.lastError ? (
          <Box>
            <Text fontWeight="semibold" mb={1}>
              Last error:
            </Text>
            <Box
              as="pre"
              p={2}
              borderRadius="sm"
              bg="blackAlpha.600"
              fontSize="xs"
              whiteSpace="pre-wrap"
              wordBreak="break-all"
              maxH="120px"
              overflowY="auto"
            >
              {visible.lastError}
            </Box>
          </Box>
        ) : null}
      </VStack>
      <Button
        mt={3}
        size="sm"
        variant="outline"
        colorPalette="cyan"
        onClick={onCopy}
      >
        {copied ? 'Copied' : 'Copy report'}
      </Button>
      <Text mt={2} fontSize="xs" color="fg.muted">
        Your Windows user name and PATH are left out of this report.
      </Text>
    </Box>
  );
}
