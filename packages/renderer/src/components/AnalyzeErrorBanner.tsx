import type { DiagnosticsReport } from '../maxframe-api.js';

import { Box, Button, Text } from '@chakra-ui/react';

import { DiagnosticBlock } from './DiagnosticBlock.js';

type AnalyzeErrorBannerProps = {
  error: string | undefined;
  diagnosticsReport: DiagnosticsReport | undefined;
  onCopyReport: () => void;
  reportCopied: boolean;
  onRetry?: () => void;
  showYtdlpUpdate?: boolean;
  updateBlocked?: boolean;
  onUpdateYtdlp?: () => void;
};

export function AnalyzeErrorBanner({
  error,
  diagnosticsReport,
  onCopyReport,
  reportCopied,
  onRetry,
  showYtdlpUpdate = false,
  updateBlocked = false,
  onUpdateYtdlp,
}: AnalyzeErrorBannerProps) {
  if (!error) {
    return null;
  }

  return (
    <>
      <Box data-testid="error-state" role="alert">
        <Text color="red.300">{error}</Text>
        {onRetry || showYtdlpUpdate ? (
          <Box mt={2} display="flex" gap={2} flexWrap="wrap">
            {onRetry ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                colorPalette="red"
                onClick={onRetry}
              >
                Try again
              </Button>
            ) : null}
            {showYtdlpUpdate && onUpdateYtdlp ? (
              <Button
                type="button"
                size="sm"
                colorPalette="purple"
                aria-disabled={updateBlocked || undefined}
                onClick={() => {
                  if (updateBlocked) {
                    return;
                  }
                  onUpdateYtdlp();
                }}
              >
                Update yt-dlp
              </Button>
            ) : null}
          </Box>
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
