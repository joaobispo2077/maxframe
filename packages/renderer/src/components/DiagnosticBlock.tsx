import type { DiagnosticsReport } from '../maxframe-api.js';

import { Badge, Box, Button, HStack, Text, VStack } from '@chakra-ui/react';

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
        {found ? 'FOUND' : 'NOT FOUND'}
      </Badge>
    </HStack>
  );
}

export function DiagnosticBlock({
  report,
  onCopy,
  copied,
}: DiagnosticBlockProps) {
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
          path={report.ytdlpPath}
          found={report.ytdlpFound}
        />
        <ToolRow
          label="ffmpeg"
          path={report.ffmpegPath}
          found={report.ffmpegFound}
        />
        <Text color="fg.muted">
          Platform: {report.platform} ({report.arch}) · App: {report.appVersion}
        </Text>
        {report.lastError ? (
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
              {report.lastError}
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
        {copied ? 'Copied!' : 'Copy report'}
      </Button>
    </Box>
  );
}
