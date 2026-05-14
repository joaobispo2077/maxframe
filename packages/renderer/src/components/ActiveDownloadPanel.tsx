import type { DownloadProgressState } from '../hooks/useDownloadProgress.js';

import { Box } from '@chakra-ui/react';

import { DownloadProgressCard } from './DownloadProgressCard.js';

type ActiveDownloadPanelProps = {
  visible: boolean;
  progress: DownloadProgressState;
  onCancel: () => void;
};

export function ActiveDownloadPanel({
  visible,
  progress,
  onCancel,
}: ActiveDownloadPanelProps) {
  if (!visible) {
    return null;
  }

  return (
    <Box
      css={{
        '@keyframes fadeSlideIn': {
          from: { opacity: 0, transform: 'translateY(-6px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        animation: 'fadeSlideIn 0.25s ease',
      }}
    >
      <DownloadProgressCard progress={progress} onCancel={onCancel} />
    </Box>
  );
}
