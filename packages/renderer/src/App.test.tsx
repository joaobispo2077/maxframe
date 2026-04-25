import { ChakraProvider } from '@chakra-ui/react';
import {
  fireEvent,
  render as rtlRender,
  screen,
  waitFor,
} from '@testing-library/react';
import { createElement, type ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App from './App';
import { maxframeSystem } from './maxframeTheme';

function render(ui: ReactElement) {
  return rtlRender(
    createElement(ChakraProvider, { value: maxframeSystem }, ui),
  );
}

describe('App', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.maxframeApi = {
      getInitialAppState: vi.fn(),
      ping: vi.fn(),
      analyzeVideoUrl: vi.fn(),
      downloadVideo: vi.fn(),
      subscribeDownloadProgress: vi.fn(() => () => {}),
      cancelDownload: vi.fn().mockResolvedValue({ canceled: false }),
    };
  });

  it('renders the foundation message', () => {
    render(<App />);

    expect(
      screen.getByText('Paste your URL below and check the Quality available'),
    ).toBeInTheDocument();
  });

  it('analyzes URL and shows best quality details', async () => {
    const analyzeVideoUrl = vi.fn().mockResolvedValue({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      videoId: 'dQw4w9WgXcQ',
      bestQuality: {
        formatId: '299',
        container: 'mp4',
        resolutionLabel: '1080p60',
        width: 1920,
        height: 1080,
        fps: 60,
        hasVideo: true,
        hasAudio: false,
      },
      qualities: [
        {
          formatId: '299',
          container: 'mp4',
          resolutionLabel: '1080p60',
          width: 1920,
          height: 1080,
          fps: 60,
          hasVideo: true,
          hasAudio: false,
        },
      ],
    });
    window.maxframeApi.analyzeVideoUrl = analyzeVideoUrl;

    render(<App />);
    fireEvent.change(screen.getByLabelText('YouTube URL'), {
      target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Analyze quality' }));

    await waitFor(() => {
      expect(analyzeVideoUrl).toHaveBeenCalledWith(
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      );
    });

    expect(
      screen.getByText('Video ID: dQw4w9WgXcQ'),
    ).toBeInTheDocument();
    expect(screen.getByText('Best raw quality: 1080p60 @ 60fps (mp4)')).toBeInTheDocument();
  });

  it('shows a message when video id cannot be parsed', async () => {
    const analyzeVideoUrl = vi.fn().mockResolvedValue({
      url: 'https://www.youtube.com/watch?v=bad',
      videoId: undefined,
      bestQuality: undefined,
      qualities: [],
    });
    window.maxframeApi.analyzeVideoUrl = analyzeVideoUrl;

    render(<App />);
    fireEvent.change(screen.getByLabelText('YouTube URL'), {
      target: { value: 'https://www.youtube.com/watch?v=bad' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Analyze quality' }));

    await waitFor(() => {
      expect(analyzeVideoUrl).toHaveBeenCalled();
    });

    expect(
      screen.getByText(
        'Video ID could not be parsed from this URL; confirm the link uses a standard watch, shorts, embed, or youtu.be shape.',
      ),
    ).toBeInTheDocument();
  });

  it('disables analyze until a URL is entered', () => {
    render(<App />);
    expect(
      screen.getByRole('button', { name: 'Analyze quality' }),
    ).toBeDisabled();
  });

  it('shows loading label while analyzing', async () => {
    let resolveAnalysis: (value: unknown) => void = () => {};
    const analysisPromise = new Promise((resolve) => {
      resolveAnalysis = resolve;
    });
    const analyzeVideoUrl = vi.fn().mockReturnValue(analysisPromise);
    window.maxframeApi.analyzeVideoUrl = analyzeVideoUrl;

    render(<App />);
    fireEvent.change(screen.getByLabelText('YouTube URL'), {
      target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Analyze quality' }));

    expect(screen.getByRole('button', { name: 'Analyzing...' })).toBeDisabled();

    resolveAnalysis({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      videoId: 'dQw4w9WgXcQ',
      bestQuality: undefined,
      qualities: [],
    });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Analyze quality' }),
      ).toBeInTheDocument();
    });
  });

  it('shows unknown error when analyze rejects a non-Error', async () => {
    const analyzeVideoUrl = vi.fn().mockRejectedValue('boom');
    window.maxframeApi.analyzeVideoUrl = analyzeVideoUrl;

    render(<App />);
    fireEvent.change(screen.getByLabelText('YouTube URL'), {
      target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Analyze quality' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Unknown error');
    });
  });

  it('shows empty-quality message when best quality is missing', async () => {
    const analyzeVideoUrl = vi.fn().mockResolvedValue({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      videoId: 'dQw4w9WgXcQ',
      bestQuality: undefined,
      qualities: [],
    });
    window.maxframeApi.analyzeVideoUrl = analyzeVideoUrl;

    render(<App />);
    fireEvent.change(screen.getByLabelText('YouTube URL'), {
      target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Analyze quality' }));

    await waitFor(() => {
      expect(
        screen.getByText('No downloadable video quality available for this URL.'),
      ).toBeInTheDocument();
    });
  });

  it('shows transparency explainer after analyze', async () => {
    const analyzeVideoUrl = vi.fn().mockResolvedValue({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      videoId: 'dQw4w9WgXcQ',
      bestQuality: {
        formatId: '299',
        container: 'mp4',
        resolutionLabel: '1080p60',
        width: 1920,
        height: 1080,
        fps: 60,
        hasVideo: true,
        hasAudio: false,
      },
      qualities: [
        {
          formatId: '299',
          container: 'mp4',
          resolutionLabel: '1080p60',
          width: 1920,
          height: 1080,
          fps: 60,
          hasVideo: true,
          hasAudio: false,
        },
      ],
    });
    window.maxframeApi.analyzeVideoUrl = analyzeVideoUrl;

    render(<App />);
    fireEvent.change(screen.getByLabelText('YouTube URL'), {
      target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Analyze quality' }));

    await waitFor(() => {
      expect(
        screen.getByRole('region', { name: 'quality-results' }),
      ).toBeInTheDocument();
    });
    expect(screen.getByText('What this list shows')).toBeInTheDocument();
    expect(screen.getByText(/Qualities are whatever/)).toBeInTheDocument();
  });

  it('lists multiple quality rows', async () => {
    const analyzeVideoUrl = vi.fn().mockResolvedValue({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      videoId: 'dQw4w9WgXcQ',
      bestQuality: {
        formatId: 'b',
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
          formatId: 'a',
          container: 'mp4',
          resolutionLabel: '720p',
          width: 1280,
          height: 720,
          fps: 30,
          hasVideo: true,
          hasAudio: false,
        },
        {
          formatId: 'b',
          container: 'mp4',
          resolutionLabel: '1080p',
          width: 1920,
          height: 1080,
          fps: 30,
          hasVideo: true,
          hasAudio: false,
        },
      ],
    });
    window.maxframeApi.analyzeVideoUrl = analyzeVideoUrl;

    render(<App />);
    fireEvent.change(screen.getByLabelText('YouTube URL'), {
      target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Analyze quality' }));

    await waitFor(() => {
      expect(screen.getByText(/format a/)).toBeInTheDocument();
    });
    expect(screen.getByText(/format b/)).toBeInTheDocument();
  });

  it('downloads a quality row and shows saved path', async () => {
    const analyzeVideoUrl = vi.fn().mockResolvedValue({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      videoId: 'dQw4w9WgXcQ',
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
    });
    const downloadVideo = vi.fn().mockResolvedValue({
      outputPath: 'C:\\Videos\\out.mp4',
    });
    window.maxframeApi.analyzeVideoUrl = analyzeVideoUrl;
    window.maxframeApi.downloadVideo = downloadVideo;

    render(<App />);
    fireEvent.change(screen.getByLabelText('YouTube URL'), {
      target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Analyze quality' }));

    await waitFor(() => {
      expect(screen.getByText(/format 137/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Download' }));

    await waitFor(() => {
      expect(downloadVideo).toHaveBeenCalledWith({
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        formatId: '137',
        hasAudio: false,
        suggestedFileName: 'dQw4w9WgXcQ-137.mp4',
      });
    });

    expect(
      screen.getByText('Saved to C:\\Videos\\out.mp4'),
    ).toBeInTheDocument();
  });

  it('keeps analyze results when download fails', async () => {
    const analyzeVideoUrl = vi.fn().mockResolvedValue({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      videoId: 'dQw4w9WgXcQ',
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
    });
    const downloadVideo = vi
      .fn()
      .mockRejectedValue(new Error('Could not run "ffmpeg".'));
    window.maxframeApi.analyzeVideoUrl = analyzeVideoUrl;
    window.maxframeApi.downloadVideo = downloadVideo;

    render(<App />);
    fireEvent.change(screen.getByLabelText('YouTube URL'), {
      target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Analyze quality' }));

    await waitFor(() => {
      expect(screen.getByText(/format 137/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Download' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Could not run');
    });

    expect(screen.getByText('Video ID: dQw4w9WgXcQ')).toBeInTheDocument();
  });

  it('dismisses the save path message', async () => {
    const analyzeVideoUrl = vi.fn().mockResolvedValue({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      videoId: 'dQw4w9WgXcQ',
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
    });
    const downloadVideo = vi.fn().mockResolvedValue({
      outputPath: 'C:\\Videos\\out.mp4',
    });
    window.maxframeApi.analyzeVideoUrl = analyzeVideoUrl;
    window.maxframeApi.downloadVideo = downloadVideo;

    render(<App />);
    fireEvent.change(screen.getByLabelText('YouTube URL'), {
      target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Analyze quality' }));

    await waitFor(() => {
      expect(screen.getByText(/format 137/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Download' }));

    await waitFor(() => {
      expect(
        screen.getByText('Saved to C:\\Videos\\out.mp4'),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Dismiss save message' }),
    );

    expect(
      screen.queryByText('Saved to C:\\Videos\\out.mp4'),
    ).not.toBeInTheDocument();
  });
});
