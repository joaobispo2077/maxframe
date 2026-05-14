import type { DiagnosticsReport } from '../maxframe-api.js';

import { Text } from '@chakra-ui/react';

import { DiagnosticBlock } from './DiagnosticBlock.js';

type AnalyzeErrorBannerProps = {
  error: string | undefined;
  debugMode: boolean;
  diagnosticsReport: DiagnosticsReport | undefined;
  onCopyReport: () => void;
  reportCopied: boolean;
};

export function AnalyzeErrorBanner({
  error,
  debugMode,
  diagnosticsReport,
  onCopyReport,
  reportCopied,
}: AnalyzeErrorBannerProps) {
  if (!error) {
    return null;
  }

  return (
    <>
      <Text role="alert" color="red.300">
        {error}
      </Text>
      {debugMode && diagnosticsReport ? (
        <DiagnosticBlock
          report={diagnosticsReport}
          onCopy={onCopyReport}
          copied={reportCopied}
        />
      ) : null}
    </>
  );
}
