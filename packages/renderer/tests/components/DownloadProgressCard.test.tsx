import { type ReactElement } from 'react';

import { ChakraProvider } from '@chakra-ui/react';
import { fireEvent, render as rtlRender, screen } from '@testing-library/react';
import { DownloadProgressCard } from '@ui/components/DownloadProgressCard';
import { maxframeSystem } from '@ui/theme/maxframeTheme';
import { describe, expect, it, vi } from 'vitest';

function render(ui: ReactElement) {
  return rtlRender(
    <ChakraProvider value={maxframeSystem}>{ui}</ChakraProvider>,
  );
}

const waitingProgress = {
  stage: 'waiting' as const,
  percent: 0,
  speedLabel: '',
  etaLabel: '',
  sizeLabel: '',
};

describe('DownloadProgressCard', () => {
  it('shows 0% while in waiting stage', () => {
    render(
      <DownloadProgressCard progress={waitingProgress} onCancel={vi.fn()} />,
    );
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('shows live percent while downloading', () => {
    render(
      <DownloadProgressCard
        progress={{ ...waitingProgress, stage: 'downloading', percent: 42 }}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText('42%')).toBeInTheDocument();
  });

  it('shows 100% when done', () => {
    render(
      <DownloadProgressCard
        progress={{ ...waitingProgress, stage: 'done', percent: 100 }}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('shows the stage label badge', () => {
    render(
      <DownloadProgressCard progress={waitingProgress} onCancel={vi.fn()} />,
    );
    expect(screen.getByText('Starting…')).toBeInTheDocument();
  });

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn();
    render(
      <DownloadProgressCard progress={waitingProgress} onCancel={onCancel} />,
    );
    fireEvent.click(screen.getByTestId('download-cancel-btn'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('shows merge status instead of waiting message during merging', () => {
    render(
      <DownloadProgressCard
        progress={{
          ...waitingProgress,
          stage: 'merging',
          percent: 0,
          sizeLabel: 'Merging formats into "video.mp4"',
        }}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText(/Merging formats into/)).toBeInTheDocument();
    expect(screen.queryByText(/Waiting for yt-dlp/)).not.toBeInTheDocument();
  });

  it('shows ffmpeg frame stats during merging', () => {
    render(
      <DownloadProgressCard
        progress={{
          ...waitingProgress,
          stage: 'merging',
          percent: 0,
          speedLabel: 'frame 120',
          sizeLabel: 'time 00:00:05.00',
        }}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText(/frame 120/)).toBeInTheDocument();
    expect(screen.getByText(/time 00:00:05.00/)).toBeInTheDocument();
  });

  it('shows merge percent when postprocess reports it', () => {
    render(
      <DownloadProgressCard
        progress={{
          ...waitingProgress,
          stage: 'merging',
          percent: 45,
          sizeLabel: 'Merging streams',
        }}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText('45%')).toBeInTheDocument();
  });

  it('shows stats line when speed is available', () => {
    render(
      <DownloadProgressCard
        progress={{
          ...waitingProgress,
          stage: 'downloading',
          percent: 55,
          speedLabel: '2.4 MB/s',
          etaLabel: '00:30',
          sizeLabel: '120 MiB',
        }}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText(/2.4 MB\/s/)).toBeInTheDocument();
    expect(screen.getByText(/ETA 00:30/)).toBeInTheDocument();
  });
});
