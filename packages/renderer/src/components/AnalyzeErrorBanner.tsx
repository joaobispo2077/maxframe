import type { DiagnosticsReport } from '../maxframe-api.js';

import { Box, Button, Text } from '@chakra-ui/react';

import { DiagnosticBlock } from './DiagnosticBlock.js';

type AnalyzeErrorBannerProps = {
  error: string | undefined;
  diagnosticsReport: DiagnosticsReport | undefined;
  onCopyReport: () => void;
  reportCopied: boolean;
  onRetry?: () => void;
};

export function AnalyzeErrorBanner({
  error,
  diagnosticsReport,
  onCopyReport,
  reportCopied,
  onRetry,
}: AnalyzeErrorBannerProps) {
  if (!error) {
    return null;
  }

  return (
    <>
      <Box data-testid="error-state" role="alert">
        <Text color="red.300">{error}</Text>
        {onRetry ? (
          <Button
            mt={2}
            size="sm"
            variant="outline"
            colorPalette="red"
            onClick={onRetry}
          >
            Try again
          </Button>
        ) : null}
      </Box>
      {diagnosticsReport ? (
        <DiagnosticBlock
          report={diagnosticsReport}
          onCopy={onCopyReport}
          copied={reportCopied}
        />
      ) : null}
    </>
  );
}
