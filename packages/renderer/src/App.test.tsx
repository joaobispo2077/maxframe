import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App from './App';

describe('App', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.maxframeApi = {
      getInitialAppState: vi.fn(),
      ping: vi.fn(),
      analyzeVideoUrl: vi.fn(),
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
});
