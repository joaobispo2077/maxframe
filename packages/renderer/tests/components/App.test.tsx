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

/** Minimal extra fields required by the updated AnalyzeVideoUrlResult */
const EXTRA_FIELDS = {
  title: 'Test Video',
  uploader: 'Test Channel',
  audioQualities: [],
  bestAudioQuality: undefined,
};

describe('App', () => {
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

  it('renders analyze guidance in the header and next to the URL field', () => {
    render(<App />);

    expect(
      screen.getByText(
        'Pick a video, compare quality options, then download.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'One URL per line. Analyze quality previews the first URL. Add to queue sends every URL to the Queue tab.',
      ),
    ).toBeInTheDocument();
  });

  it('shows a queue-specific header message on the Queue tab', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('tab', { name: 'Queue' }));

    await waitFor(() => {
      expect(
        screen.getByText(
          'Download multiple videos you added from Analyze.',
        ),
      ).toBeInTheDocument();
    });
  });

  it('hides download queue on the default Analyze tab', () => {
    render(<App />);

    expect(
      screen.queryByRole('heading', { name: /download queue/i }),
    ).not.toBeInTheDocument();
  });

  it('shows download queue heading on the Queue tab', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('tab', { name: 'Queue' }));

    expect(
      screen.getByRole('heading', { name: /download queue/i }),
    ).toBeInTheDocument();
  });

  it('calls analyzeVideoUrl with only the first non-empty line when several URLs are present', async () => {
    const analyzeVideoUrl = vi.fn().mockResolvedValue({
      ...EXTRA_FIELDS,
      url: 'https://www.youtube.com/watch?v=firstonly',
      videoId: 'firstonly',
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
    fireEvent.change(screen.getByLabelText('Video URLs'), {
      target: {
        value:
          'https://www.youtube.com/watch?v=firstonly\nhttps://youtu.be/secondline',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Analyze quality' }));

    await waitFor(() => {
      expect(analyzeVideoUrl).toHaveBeenCalledWith(
        'https://www.youtube.com/watch?v=firstonly',
      );
    });
  });

  it('clears Video URLs after Add to queue and shows queue rows', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Video URLs'), {
      target: {
        value:
          'https://www.youtube.com/watch?v=aaa\nhttps://youtu.be/bbb',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /add to queue/i }));
    expect((screen.getByLabelText('Video URLs') as HTMLTextAreaElement).value).toBe(
      '',
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Queue' }));
    expect(screen.queryByText(/No active queue items/i)).not.toBeInTheDocument();
  });

  it('shows Portable badge when isPortable is true', async () => {
    window.maxframeApi.getInitialAppState = vi.fn().mockResolvedValue({
      appName: 'Maxframe',
      status: 'ready',
      isPortable: true,
      titleBarInset: { height: 0, padLeft: 0, padRight: 0 },
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Portable')).toBeInTheDocument();
    });
  });

  it('does not show Portable badge when isPortable is false', async () => {
    window.maxframeApi.getInitialAppState = vi.fn().mockResolvedValue({
      appName: 'Maxframe',
      status: 'ready',
      isPortable: false,
      titleBarInset: { height: 0, padLeft: 0, padRight: 0 },
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.queryByText('Portable')).not.toBeInTheDocument();
    });
  });

  it('opens settings tab and returns to analyze tab', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('tab', { name: 'Settings' }));
    expect(
      screen.getByRole('heading', { name: 'Settings' }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Analyze' }));
    expect(
      screen.getByRole('button', { name: /analyze quality/i }),
    ).toBeInTheDocument();
  });

  it('analyzes URL and shows best quality details', async () => {
    const analyzeVideoUrl = vi.fn().mockResolvedValue({
      ...EXTRA_FIELDS,
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
    fireEvent.change(screen.getByLabelText('Video URLs'), {
      target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Analyze quality' }));

    await waitFor(() => {
      expect(analyzeVideoUrl).toHaveBeenCalledWith(
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      );
    });

    expect(screen.getByText('Video ID: dQw4w9WgXcQ')).toBeInTheDocument();
    expect(
      screen.getByText('Best raw quality: 1080p60 @ 60fps (mp4)'),
    ).toBeInTheDocument();
  });

  it('shows a message when video id cannot be parsed', async () => {
    const analyzeVideoUrl = vi.fn().mockResolvedValue({
      ...EXTRA_FIELDS,
      url: 'https://www.youtube.com/watch?v=bad',
      videoId: undefined,
      bestQuality: undefined,
      qualities: [],
    });
    window.maxframeApi.analyzeVideoUrl = analyzeVideoUrl;

    render(<App />);
    fireEvent.change(screen.getByLabelText('Video URLs'), {
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
    fireEvent.change(screen.getByLabelText('Video URLs'), {
      target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Analyze quality' }));

    expect(screen.getByRole('button', { name: 'Analyzing...' })).toBeDisabled();

    resolveAnalysis({
      ...EXTRA_FIELDS,
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
    fireEvent.change(screen.getByLabelText('Video URLs'), {
      target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Analyze quality' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Unknown error');
    });
  });

  it('shows empty-quality message when best quality is missing', async () => {
    const analyzeVideoUrl = vi.fn().mockResolvedValue({
      ...EXTRA_FIELDS,
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      videoId: 'dQw4w9WgXcQ',
      bestQuality: undefined,
      qualities: [],
    });
    window.maxframeApi.analyzeVideoUrl = analyzeVideoUrl;

    render(<App />);
    fireEvent.change(screen.getByLabelText('Video URLs'), {
      target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Analyze quality' }));

    await waitFor(() => {
      expect(
        screen.getByText(
          'No downloadable video quality available for this URL.',
        ),
      ).toBeInTheDocument();
    });
  });

  it('shows transparency explainer after analyze', async () => {
    const analyzeVideoUrl = vi.fn().mockResolvedValue({
      ...EXTRA_FIELDS,
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
    fireEvent.change(screen.getByLabelText('Video URLs'), {
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
      ...EXTRA_FIELDS,
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
    fireEvent.change(screen.getByLabelText('Video URLs'), {
      target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Analyze quality' }));

    await waitFor(() => {
      expect(screen.getByText('720p @ 30fps')).toBeInTheDocument();
    });
    expect(screen.getByText('1080p @ 30fps')).toBeInTheDocument();
  });

  it('downloads a quality row and shows saved path', async () => {
    const analyzeVideoUrl = vi.fn().mockResolvedValue({
      ...EXTRA_FIELDS,
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
    fireEvent.change(screen.getByLabelText('Video URLs'), {
      target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Analyze quality' }));

    await waitFor(() => {
      expect(screen.getByText('1080p @ 30fps')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Download' }));

    await waitFor(() => {
      expect(downloadVideo).toHaveBeenCalledWith({
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        formatId: '137',
        hasAudio: false,
        suggestedFileName: 'Test Video - Test Channel.mp4',
        outputMode: 'mp4',
      });
    });

    expect(
      screen.getByText('Saved to C:\\Videos\\out.mp4'),
    ).toBeInTheDocument();
  });

  it('keeps analyze results when download fails', async () => {
    const analyzeVideoUrl = vi.fn().mockResolvedValue({
      ...EXTRA_FIELDS,
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
    fireEvent.change(screen.getByLabelText('Video URLs'), {
      target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Analyze quality' }));

    await waitFor(() => {
      expect(screen.getByText('1080p @ 30fps')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Download' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Could not run');
    });

    expect(screen.getByText('Video ID: dQw4w9WgXcQ')).toBeInTheDocument();
  });

  it('dismisses the save path message', async () => {
    const analyzeVideoUrl = vi.fn().mockResolvedValue({
      ...EXTRA_FIELDS,
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
    fireEvent.change(screen.getByLabelText('Video URLs'), {
      target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Analyze quality' }));

    await waitFor(() => {
      expect(screen.getByText('1080p @ 30fps')).toBeInTheDocument();
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

  it('shows only one row per resolution when multiple formats share the same height and fps', async () => {
    const analyzeVideoUrl = vi.fn().mockResolvedValue({
      ...EXTRA_FIELDS,
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      videoId: 'dQw4w9WgXcQ',
      bestQuality: {
        formatId: '308',
        container: 'webm',
        resolutionLabel: '1440p',
        width: 2560,
        height: 1440,
        fps: 60,
        hasVideo: true,
        hasAudio: false,
        videoBitrateKbps: 3866,
      },
      qualities: [
        {
          formatId: '308',
          container: 'webm',
          resolutionLabel: '1440p',
          width: 2560,
          height: 1440,
          fps: 60,
          hasVideo: true,
          hasAudio: false,
          videoBitrateKbps: 3866,
        },
        {
          formatId: '400',
          container: 'mp4',
          resolutionLabel: '1440p',
          width: 2560,
          height: 1440,
          fps: 60,
          hasVideo: true,
          hasAudio: false,
          videoBitrateKbps: 4542,
        },
        {
          formatId: '299',
          container: 'mp4',
          resolutionLabel: '1080p',
          width: 1920,
          height: 1080,
          fps: 60,
          hasVideo: true,
          hasAudio: false,
          videoBitrateKbps: 4072,
        },
      ],
    });
    window.maxframeApi.analyzeVideoUrl = analyzeVideoUrl;

    render(<App />);
    fireEvent.change(screen.getByLabelText('Video URLs'), {
      target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Analyze quality' }));

    await waitFor(() => {
      expect(screen.getByText('1440p @ 60fps')).toBeInTheDocument();
    });

    expect(screen.getByText('1080p @ 60fps')).toBeInTheDocument();
    // Both 1440p formats (formatId 308 and 400) share the same height+fps —
    // only one row should be rendered for them.
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('shows Open folder button after download and calls showItemInFolder on click', async () => {
    const analyzeVideoUrl = vi.fn().mockResolvedValue({
      ...EXTRA_FIELDS,
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
    fireEvent.change(screen.getByLabelText('Video URLs'), {
      target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Analyze quality' }));

    await waitFor(() => {
      expect(screen.getByText('1080p @ 30fps')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Download' }));

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Open containing folder' }),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Open containing folder' }),
    );

    expect(window.maxframeApi.showItemInFolder).toHaveBeenCalledWith(
      'C:\\Videos\\out.mp4',
    );
  });

  it('clears Open folder button when Dismiss is clicked', async () => {
    const analyzeVideoUrl = vi.fn().mockResolvedValue({
      ...EXTRA_FIELDS,
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
    fireEvent.change(screen.getByLabelText('Video URLs'), {
      target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Analyze quality' }));
    await waitFor(() => {
      expect(screen.getByText('1080p @ 30fps')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Open containing folder' }),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Dismiss save message' }),
    );

    expect(
      screen.queryByRole('button', { name: 'Open containing folder' }),
    ).not.toBeInTheDocument();
  });
});
