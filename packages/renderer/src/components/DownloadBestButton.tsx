import type { AnalyzeVideoResult } from '../lib/analyzeVideoResultType.js';

import { Button } from '@chakra-ui/react';

import { resolveBestDownload } from '../lib/resolveBestDownload.js';

type DownloadBestButtonProps = {
  result: AnalyzeVideoResult;
  outputMode: 'mp3' | 'mp4';
  downloadBusy: boolean;
  loading: boolean;
  onDownload: (formatId: string, hasAudio: boolean) => void;
};

export function DownloadBestButton({
  result,
  outputMode,
  downloadBusy,
  loading,
  onDownload,
}: DownloadBestButtonProps) {
  const target = resolveBestDownload(result, outputMode);
  if (!target) {
    return null;
  }

  return (
    <Button
      type="button"
      colorPalette="purple"
      variant="solid"
      size="md"
      cursor="pointer"
      transition="colors 0.2s ease"
      onClick={() => void onDownload(target.formatId, target.hasAudio)}
      disabled={downloadBusy || loading}
      aria-label={`Download best ${outputMode.toUpperCase()} (${target.label})`}
    >
      Download best {outputMode.toUpperCase()} ({target.label})
    </Button>
  );
}
