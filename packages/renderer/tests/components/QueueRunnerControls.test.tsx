import { type ReactElement } from 'react';

import { summarizeQueue, createEmptyQueueModel, enqueueJobs } from '@src/domain/download-queue/model.js';
import { ChakraProvider } from '@chakra-ui/react';
import { fireEvent, render as rtlRender, screen } from '@testing-library/react';
import { QueueRunnerControls } from '@ui/components/QueueRunnerControls';
import { maxframeSystem } from '@ui/theme/maxframeTheme';
import { describe, expect, it, vi } from 'vitest';

function render(ui: ReactElement) {
  return rtlRender(
    <ChakraProvider value={maxframeSystem}>{ui}</ChakraProvider>,
  );
}

const EMPTY_SUMMARY = summarizeQueue(createEmptyQueueModel());

describe('QueueRunnerControls', () => {
  it('disables Start when canStart is false', () => {
    render(
      <QueueRunnerControls
        running={false}
        canStart={false}
        jobCount={0}
        summary={EMPTY_SUMMARY}
        onStart={vi.fn()}
        onStop={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /start queue/i })).toBeDisabled();
  });

  it('calls onStart when Start is clicked', () => {
    const onStart = vi.fn();
    const model = enqueueJobs(createEmptyQueueModel(), [
      { id: 'j1', url: 'https://youtu.be/a' },
    ]);
    render(
      <QueueRunnerControls
        running={false}
        canStart={true}
        jobCount={1}
        summary={summarizeQueue(model)}
        onStart={onStart}
        onStop={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /start queue/i }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('shows Stop when running', () => {
    render(
      <QueueRunnerControls
        running={true}
        canStart={false}
        jobCount={1}
        summary={EMPTY_SUMMARY}
        onStart={vi.fn()}
        onStop={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /stop queue/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /start queue/i })).not.toBeInTheDocument();
  });
});
