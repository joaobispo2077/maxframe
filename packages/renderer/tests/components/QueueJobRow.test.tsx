import { type ReactElement } from 'react';

import type { QueueJob } from '@src/domain/download-queue/model.js';
import { ChakraProvider } from '@chakra-ui/react';
import { render as rtlRender, screen } from '@testing-library/react';
import { QueueJobRow } from '@ui/components/QueueJobRow';
import { maxframeSystem } from '@ui/theme/maxframeTheme';
import { describe, expect, it, vi } from 'vitest';

function render(ui: ReactElement) {
  return rtlRender(
    <ChakraProvider value={maxframeSystem}>{ui}</ChakraProvider>,
  );
}

const BASE_JOB: QueueJob = {
  id: 'job-1',
  orderIndex: 0,
  submittedUrl: 'https://www.youtube.com/watch?v=a',
  createdAt: Date.now(),
  analysis: { url: 'https://www.youtube.com/watch?v=a', title: 'Active Video' },
  formatChoice: { formatId: '137', hasAudio: false },
  downloadStarted: true,
  phase: 'download',
  status: 'Downloading',
  progress: {
    percent: 42,
    speedLabel: '5.00MiB/s',
    etaLabel: '00:10',
    sizeLabel: '100.00MiB',
    stage: 'downloading',
  },
};

describe('QueueJobRow', () => {
  it('shows live progress percent for active downloading job', () => {
    render(
      <QueueJobRow
        job={BASE_JOB}
        isActive={true}
        disableMoveUp={true}
        disableMoveDown={true}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByText('42%')).toBeInTheDocument();
    expect(screen.getByText(/5\.00MiB\/s/)).toBeInTheDocument();
  });
});
