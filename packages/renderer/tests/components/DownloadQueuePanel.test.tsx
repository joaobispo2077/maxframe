import { type ReactElement } from 'react';

import {
  createEmptyQueueModel,
  enqueueJobs,
  summarizeQueue,
} from '@src/domain/download-queue/model.js';
import { ChakraProvider } from '@chakra-ui/react';
import {
  fireEvent,
  render as rtlRender,
  screen,
  within,
} from '@testing-library/react';
import { DownloadQueuePanel } from '@ui/components/DownloadQueuePanel';
import { maxframeSystem } from '@ui/theme/maxframeTheme';
import { describe, expect, it, vi } from 'vitest';

function render(ui: ReactElement) {
  return rtlRender(
    <ChakraProvider value={maxframeSystem}>{ui}</ChakraProvider>,
  );
}

describe('DownloadQueuePanel', () => {
  it('shows empty queue copy when model has no jobs', () => {
    const model = createEmptyQueueModel();
    const summary = summarizeQueue(model);
    render(
      <DownloadQueuePanel
        model={model}
        summary={summary}
        moveJobInQueue={vi.fn()}
        removeJobFromQueue={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: /download queue/i })).toBeInTheDocument();
    expect(screen.getByText(/No active queue items/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Use Add to queue above to build a batch/i),
    ).toBeInTheDocument();
  });

  it('renders one row per queued job', () => {
    const model = enqueueJobs(createEmptyQueueModel(), [
      { id: 'job-a', url: 'https://www.youtube.com/watch?v=aaa' },
      { id: 'job-b', url: 'https://youtu.be/bbb' },
    ]);
    const summary = summarizeQueue(model);
    render(
      <DownloadQueuePanel
        model={model}
        summary={summary}
        moveJobInQueue={vi.fn()}
        removeJobFromQueue={vi.fn()}
      />,
    );

    expect(screen.queryByText(/No active queue items/i)).not.toBeInTheDocument();
    expect(
      screen.getAllByText('https://www.youtube.com/watch?v=aaa').length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('https://youtu.be/bbb').length).toBeGreaterThanOrEqual(1);
  });

  it('disables move up on the first row only', () => {
    const model = enqueueJobs(createEmptyQueueModel(), [
      { id: 'job-0', url: 'https://www.youtube.com/watch?v=first' },
      { id: 'job-1', url: 'https://youtu.be/second' },
    ]);
    const summary = summarizeQueue(model);
    render(
      <DownloadQueuePanel
        model={model}
        summary={summary}
        moveJobInQueue={vi.fn()}
        removeJobFromQueue={vi.fn()}
      />,
    );

    const firstRow = screen.getByTestId('queue-job-job-0');
    const secondRow = screen.getByTestId('queue-job-job-1');

    expect(
      within(firstRow).getByRole('button', {
        name: /move up in queue/i,
      }),
    ).toBeDisabled();
    expect(
      within(secondRow).getByRole('button', {
        name: /move up in queue/i,
      }),
    ).toBeEnabled();
  });
});
