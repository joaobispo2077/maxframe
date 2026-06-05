import { type ReactElement } from 'react';

import { ChakraProvider } from '@chakra-ui/react';
import {
  fireEvent,
  render as rtlRender,
  screen,
  waitFor,
} from '@testing-library/react';
import App from '@ui/App';
import { maxframeSystem } from '@ui/theme/maxframeTheme';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function render(ui: ReactElement) {
  return rtlRender(
    <ChakraProvider value={maxframeSystem}>{ui}</ChakraProvider>,
  );
}

const BASE_ANALYZE_RESULT = {
  url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  videoId: 'dQw4w9WgXcQ',
  title: 'Video Title',
  uploader: 'Channel',
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
    },
  ],
  audioQualities: [
    {
      formatId: '251',
      container: 'webm',
      resolutionLabel: 'Audio-only',
      width: 0,
      height: 0,
      fps: 0,
      hasVideo: false,
      hasAudio: true,
      audioBitrateKbps: 160,
    },
  ],
  bestAudioQuality: {
    formatId: '251',
    container: 'webm',
    resolutionLabel: 'Audio-only',
    width: 0,
    height: 0,
    fps: 0,
    hasVideo: false,
    hasAudio: true,
    audioBitrateKbps: 160,
  },
};

describe('App — output format selector', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.maxframeApi = {
      getInitialAppState: vi.fn().mockResolvedValue({
        appName: 'Maxframe',
        status: 'ready',
        isPortable: false,
      }),
      ping: vi.fn(),
      analyzeVideoUrl: vi.fn(),
      downloadVideo: vi.fn(),
      subscribeDownloadProgress: vi.fn(() => () => {}),
      cancelDownload: vi.fn().mockResolvedValue({ canceled: false }),
      pickOutputFolder: vi.fn().mockResolvedValue({ canceled: true }),
      setDebugMode: vi.fn().mockResolvedValue(undefined),
      getDiagnostics: vi.fn().mockResolvedValue(undefined),
      getLogPath: vi
        .fn()
        .mockResolvedValue('C:\\AppData\\Maxframe\\maxframe-debug.log'),
      showItemInFolder: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('renders an output format selector with label "Output format"', () => {
    render(<App />);
    expect(screen.getByLabelText('Output format')).toBeInTheDocument();
  });

  it('defaults to mp4 mode', () => {
    render(<App />);
    const select = screen.getByLabelText('Output format') as HTMLSelectElement;
    expect(select.value).toBe('mp4');
  });

  it('switches to mp3 mode when user selects MP3', () => {
    render(<App />);
    const select = screen.getByLabelText('Output format');
    fireEvent.change(select, { target: { value: 'mp3' } });
    expect((select as HTMLSelectElement).value).toBe('mp3');
  });

  it('shows video quality list in mp4 mode after analyze', async () => {
    window.maxframeApi.analyzeVideoUrl = vi
      .fn()
      .mockResolvedValue(BASE_ANALYZE_RESULT);
    render(<App />);

    fireEvent.change(screen.getByLabelText('Video URLs'), {
      target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Analyze quality' }));

    await waitFor(() => {
      expect(screen.getByText('1080p @ 30fps')).toBeInTheDocument();
    });
  });

  it('shows audio quality list in mp3 mode after analyze', async () => {
    window.maxframeApi.analyzeVideoUrl = vi
      .fn()
      .mockResolvedValue(BASE_ANALYZE_RESULT);
    render(<App />);

    fireEvent.change(screen.getByLabelText('Output format'), {
      target: { value: 'mp3' },
    });
    fireEvent.change(screen.getByLabelText('Video URLs'), {
      target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Analyze quality' }));

    await waitFor(() => {
      expect(screen.getByText('160kbps')).toBeInTheDocument();
    });
  });

  it('downloading in MP4 mode sends outputMode mp4 and title-based suggestedFileName', async () => {
    const downloadVideo = vi
      .fn()
      .mockResolvedValue({ outputPath: 'C:\\out.mp4' });
    window.maxframeApi.analyzeVideoUrl = vi
      .fn()
      .mockResolvedValue(BASE_ANALYZE_RESULT);
    window.maxframeApi.downloadVideo = downloadVideo;

    render(<App />);
    fireEvent.change(screen.getByLabelText('Video URLs'), {
      target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Analyze quality' }));

    await waitFor(() => {
      expect(screen.getByText('1080p @ 30fps')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Download' }));

    await waitFor(() => {
      expect(downloadVideo).toHaveBeenCalledWith(
        expect.objectContaining({
          outputMode: 'mp4',
          suggestedFileName: 'Video Title - Channel.mp4',
        }),
      );
    });
  });

  it('downloading in MP3 mode sends outputMode mp3 and .mp3 suggestedFileName', async () => {
    const downloadVideo = vi
      .fn()
      .mockResolvedValue({ outputPath: 'C:\\out.mp3' });
    window.maxframeApi.analyzeVideoUrl = vi
      .fn()
      .mockResolvedValue(BASE_ANALYZE_RESULT);
    window.maxframeApi.downloadVideo = downloadVideo;

    render(<App />);
    fireEvent.change(screen.getByLabelText('Output format'), {
      target: { value: 'mp3' },
    });
    fireEvent.change(screen.getByLabelText('Video URLs'), {
      target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Analyze quality' }));

    await waitFor(() => {
      expect(screen.getByText('160kbps')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Download' }));

    await waitFor(() => {
      expect(downloadVideo).toHaveBeenCalledWith(
        expect.objectContaining({
          outputMode: 'mp3',
          suggestedFileName: 'Video Title - Channel.mp3',
        }),
      );
    });
  });

  it('shows Ranked #1 (app) badge for best audio quality in mp3 mode', async () => {
    window.maxframeApi.analyzeVideoUrl = vi
      .fn()
      .mockResolvedValue(BASE_ANALYZE_RESULT);
    render(<App />);

    fireEvent.change(screen.getByLabelText('Output format'), {
      target: { value: 'mp3' },
    });
    fireEvent.change(screen.getByLabelText('Video URLs'), {
      target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Analyze quality' }));

    await waitFor(() => {
      expect(screen.getByText('Ranked #1 (app)')).toBeInTheDocument();
    });
  });
});
