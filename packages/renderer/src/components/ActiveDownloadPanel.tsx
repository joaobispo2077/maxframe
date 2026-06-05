import type { DownloadProgressState } from '../hooks/useDownloadProgress.js';

import { Box } from '@chakra-ui/react';

import { fadeSlideInRevealStyles } from '../theme/motionStyles.js';
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
    <Box css={fadeSlideInRevealStyles}>
      <DownloadProgressCard progress={progress} onCancel={onCancel} />
    </Box>
  );
}
