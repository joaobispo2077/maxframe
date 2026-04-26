import { type ReactElement } from 'react';

import { ChakraProvider } from '@chakra-ui/react';
import {
  fireEvent,
  render as rtlRender,
  screen,
  waitFor,
} from '@testing-library/react';
import HomePage from '@ui/pages/HomePage';
import { maxframeSystem } from '@ui/theme/maxframeTheme';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function render(ui: ReactElement) {
  return rtlRender(
    <ChakraProvider value={maxframeSystem}>{ui}</ChakraProvider>,
  );
}

describe('HomePage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.maxframeApi = {
      getInitialAppState: vi.fn().mockResolvedValue({ appName: 'Maxframe', status: 'ready', isPortable: false }),
      ping: vi.fn(),
      analyzeVideoUrl: vi.fn(),
      downloadVideo: vi.fn(),
      subscribeDownloadProgress: vi.fn(() => () => {}),
      cancelDownload: vi.fn().mockResolvedValue({ canceled: false }),
      setDebugMode: vi.fn().mockResolvedValue(undefined),
      getDiagnostics: vi.fn().mockResolvedValue(undefined),
      getLogPath: vi.fn().mockResolvedValue('C:\\AppData\\Maxframe\\maxframe-debug.log'),
    };
  });

  it('renders analysis details and supports enter-to-download', async () => {
    const analyzeVideoUrl = vi.fn().mockResolvedValue({
      url: 'https://www.youtube.com/watch?v=home123',
      videoId: undefined,
      bestQuality: {
        formatId: '137',
        container: 'mp4',
        resolutionLabel: '1080p',
        width: 1920,
        height: 1080,
        fps: 30,
        hasVideo: true,
        hasAudio: false,
      },
      qualities: [
        {
          formatId: '137',
          container: 'mp4',
          resolutionLabel: '1080p',
          width: 1920,
          height: 1080,
          fps: 30,
          hasVideo: true,
          hasAudio: false,
          videoBitrateKbps: 4200,
        },
      ],
    });
    const downloadVideo = vi.fn().mockResolvedValue({
      outputPath: 'C:\\Videos\\home.mp4',
    });
    window.maxframeApi.analyzeVideoUrl = analyzeVideoUrl;
    window.maxframeApi.downloadVideo = downloadVideo;

    render(<HomePage />);
    fireEvent.change(screen.getByLabelText('YouTube URL'), {
      target: { value: 'https://www.youtube.com/watch?v=home123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Analyze quality' }));

    await waitFor(() => {
      expect(screen.getByText(/format 137/)).toBeInTheDocument();
    });
    expect(
      screen.getByText(
        'Video ID could not be parsed from this URL; confirm the link uses a standard watch, shorts, embed, or youtu.be shape.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Ranked #1 (app)')).toBeInTheDocument();

    const group = screen.getAllByRole('group').at(-1);
    expect(group).toBeDefined();
    if (!group) {
      return;
    }
    fireEvent.focus(group);
    expect(
      screen.getByText(/This is the app’s top-ranked row/),
    ).toBeInTheDocument();

    fireEvent.keyDown(group, { key: 'Enter' });
    await waitFor(() => {
      expect(downloadVideo).toHaveBeenCalledWith({
        url: 'https://www.youtube.com/watch?v=home123',
        formatId: '137',
        hasAudio: false,
        suggestedFileName: 'video-137.mp4',
        outputMode: 'mp4',
      });
    });
  });

  it('keeps UI clean when download is canceled and allows cancel button action', async () => {
    const analyzeVideoUrl = vi.fn().mockResolvedValue({
      url: 'https://www.youtube.com/watch?v=cancel123',
      videoId: 'cancel123',
      bestQuality: {
        formatId: '248',
        container: 'webm',
        resolutionLabel: '1080p',
        width: 1920,
        height: 1080,
        fps: 30,
        hasVideo: true,
        hasAudio: false,
      },
      qualities: [
        {
          formatId: '248',
          container: 'webm',
          resolutionLabel: '1080p',
          width: 1920,
          height: 1080,
          fps: 30,
          hasVideo: true,
          hasAudio: false,
        },
      ],
    });
    const cancelDownload = vi.fn().mockResolvedValue({ canceled: true });
    window.maxframeApi.analyzeVideoUrl = analyzeVideoUrl;
    window.maxframeApi.cancelDownload = cancelDownload;
    window.maxframeApi.downloadVideo = vi
      .fn()
      .mockRejectedValue(new Error('Download canceled.'));

    render(<HomePage />);
    fireEvent.change(screen.getByLabelText('YouTube URL'), {
      target: { value: 'https://www.youtube.com/watch?v=cancel123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Analyze quality' }));

    await waitFor(() => {
      expect(screen.getByText(/format 248/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Download' }));

    await waitFor(() => {
      expect(window.maxframeApi.downloadVideo).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    const inFlight = new Promise<{ outputPath: string }>(() => {});
    window.maxframeApi.downloadVideo = vi.fn().mockReturnValue(inFlight);
    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Cancel' }),
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(cancelDownload).toHaveBeenCalledTimes(1);
  });
});
