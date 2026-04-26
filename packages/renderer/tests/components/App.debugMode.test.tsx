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

const DIAGNOSTICS_REPORT = {
  ytdlpPath: 'yt-dlp',
  ytdlpFound: false,
  ffmpegPath: 'ffmpeg',
  ffmpegFound: false,
  platform: 'win32',
  arch: 'x64',
  appVersion: '1.0.1',
  pathEnv: 'C:\\Windows',
  lastError: 'yt-dlp not found',
};

function setupMaxframeApi(overrides: Partial<typeof window.maxframeApi> = {}) {
  window.maxframeApi = {
    getInitialAppState: vi.fn().mockResolvedValue({ appName: 'Maxframe', status: 'ready', isPortable: false }),
    ping: vi.fn(),
    analyzeVideoUrl: vi.fn(),
    downloadVideo: vi.fn(),
    subscribeDownloadProgress: vi.fn(() => () => {}),
    cancelDownload: vi.fn().mockResolvedValue({ canceled: false }),
      setDebugMode: vi.fn().mockResolvedValue(undefined),
      getDiagnostics: vi.fn().mockResolvedValue(DIAGNOSTICS_REPORT),
      getLogPath: vi.fn().mockResolvedValue('C:\\AppData\\Maxframe\\maxframe-debug.log'),
      ...overrides,
  };
}

describe('App debug mode', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls getDiagnostics and renders DiagnosticBlock when error occurs and debug mode is on', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => {
      if (key === 'maxframe.debugMode') return 'true';
      return null;
    });

    setupMaxframeApi({
      analyzeVideoUrl: vi
        .fn()
        .mockRejectedValue(new Error('yt-dlp not found')),
    });

    render(<App />);

    fireEvent.change(screen.getByPlaceholderText(/youtube.com/i), {
      target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /analyze quality/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(window.maxframeApi.getDiagnostics).toHaveBeenCalled();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /copy report/i }),
      ).toBeInTheDocument();
    });
  });

  it('does NOT call getDiagnostics when debug mode is off', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => null);

    setupMaxframeApi({
      analyzeVideoUrl: vi
        .fn()
        .mockRejectedValue(new Error('yt-dlp not found')),
    });

    render(<App />);

    fireEvent.change(screen.getByPlaceholderText(/youtube.com/i), {
      target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /analyze quality/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(window.maxframeApi.getDiagnostics).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('button', { name: /copy report/i }),
    ).not.toBeInTheDocument();
  });
});
