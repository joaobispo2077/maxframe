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

const MOCK_ANALYZE_RESULT = {
  url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  videoId: 'dQw4w9WgXcQ',
  title: 'Test Video',
  uploader: 'Test Channel',
  audioQualities: [],
  bestAudioQuality: undefined,
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
};

describe('App — animated UI transitions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.maxframeApi = {
      getInitialAppState: vi.fn().mockResolvedValue({
        appName: 'Maxframe',
        status: 'ready',
        isPortable: false,
        titleBarInset: { height: 0, padLeft: 0, padRight: 0 },
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

  it('quality results section is accessible in the DOM after analysis', async () => {
    window.maxframeApi.analyzeVideoUrl = vi
      .fn()
      .mockResolvedValue(MOCK_ANALYZE_RESULT);

    render(<App />);
    fireEvent.change(screen.getByLabelText('Video URLs'), {
      target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Analyze quality' }));

    await waitFor(() => {
      expect(
        screen.getByRole('region', { name: 'quality-results' }),
      ).toBeInTheDocument();
    });
  });

  it('progress card is in DOM and cancel button is accessible during download', async () => {
    window.maxframeApi.analyzeVideoUrl = vi
      .fn()
      .mockResolvedValue(MOCK_ANALYZE_RESULT);
    let resolveDownload!: (v: { outputPath: string }) => void;
    window.maxframeApi.downloadVideo = vi.fn().mockReturnValue(
      new Promise<{ outputPath: string }>((res) => {
        resolveDownload = res;
      }),
    );

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
      expect(screen.getByTestId('download-cancel-btn')).toBeInTheDocument();
    });

    resolveDownload({ outputPath: '/out.mp4' });
  });
});
