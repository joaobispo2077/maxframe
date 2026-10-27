import { type ReactElement } from 'react';

import { ChakraProvider } from '@chakra-ui/react';
import { render as rtlRender, screen } from '@testing-library/react';
import { AnalyzeErrorBanner } from '@ui/components/AnalyzeErrorBanner';
import { DownloadBestButton } from '@ui/components/DownloadBestButton';
import { DownloadProgressCard } from '@ui/components/DownloadProgressCard';
import { OutputFormatSelect } from '@ui/components/OutputFormatSelect';
import { QualityResultRow } from '@ui/components/QualityResultRow';
import { QualityResultsPanel } from '@ui/components/QualityResultsPanel';
import { QueueJobRow } from '@ui/components/QueueJobRow';
import { SaveMessageBanner } from '@ui/components/SaveMessageBanner';
import { useActiveDownload } from '@ui/hooks/useActiveDownload';
import { useAnalyzeFlow } from '@ui/hooks/useAnalyzeFlow';
import { setLastOutputFolder } from '@ui/lib/appPreferences';
import { SettingsPage } from '@ui/pages/SettingsPage';
import { maxframeSystem } from '@ui/theme/maxframeTheme';
import { AnalyzeView } from '@ui/views/AnalyzeView';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function render(ui: ReactElement) {
  return rtlRender(
    <ChakraProvider value={maxframeSystem}>{ui}</ChakraProvider>,
  );
}

const QUALITY = {
  formatId: '0',
  container: 'mp4',
  resolutionLabel: '120p',
  width: 160,
  height: 120,
  fps: 10,
  hasVideo: true,
  hasAudio: true,
};

const RESULT = {
  url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  videoId: 'dQw4w9WgXcQ',
  title: 'Fixture',
  uploader: 'Local',
  qualities: [QUALITY],
  bestQuality: QUALITY,
  audioQualities: [],
};

describe('AC15 data-testid hooks', () => {
  beforeEach(() => {
    localStorage.clear();
    window.maxframeApi = {
      getInitialAppState: vi.fn(),
      ping: vi.fn(),
      analyzeVideoUrl: vi.fn(),
      downloadVideo: vi.fn(),
      subscribeDownloadProgress: vi.fn(() => () => {}),
      cancelDownload: vi.fn(),
      setDebugMode: vi.fn().mockResolvedValue(undefined),
      getDiagnostics: vi.fn(),
      getLogPath: vi.fn().mockResolvedValue('C:\\log.txt'),
      showItemInFolder: vi.fn(),
      pickOutputFolder: vi.fn(),
    };
  });

  it('marks the link field, format picker, and check button', () => {
    const analyze = {
      urlsText: '',
      setUrlsText: vi.fn(),
      outputMode: 'mp3',
      setOutputMode: vi.fn(),
      analyzeTargetUrl: undefined,
      loading: false,
      linkCount: 1,
      handleAddToQueue: vi.fn(),
      canAddToQueue: false,
      error: undefined,
      diagnosticsReport: undefined,
      handleCopyReport: vi.fn(),
      reportCopied: false,
      result: undefined,
    } as ReturnType<typeof useAnalyzeFlow>;
    const download = {
      downloadNote: undefined,
      savedPath: undefined,
      clearSaveMessage: vi.fn(),
      downloadBusy: false,
      progress: {
        active: false,
        percent: 0,
        speedLabel: '',
        etaLabel: '',
        sizeLabel: '',
        stage: 'waiting',
      },
      cancelActiveDownload: vi.fn(),
      hoveredFormatId: null,
      downloadFormatId: undefined,
      setHoveredFormatId: vi.fn(),
      downloadQuality: vi.fn(),
    } as ReturnType<typeof useActiveDownload>;

    render(
      <AnalyzeView
        analyze={analyze}
        download={download}
        queueRunnerActive={false}
        onAnalyze={vi.fn()}
      />,
    );

    expect(screen.getByTestId('link-input')).toBeInTheDocument();
    expect(screen.getByTestId('format-picker')).toBeInTheDocument();
    expect(screen.getByTestId('format-option-mp3')).toHaveValue('mp3');
    expect(screen.getByTestId('format-option-mp4')).toHaveValue('mp4');
    expect(screen.getByTestId('check-quality-button')).toBeInTheDocument();
  });

  it('marks the best download button and a video row', () => {
    render(
      <DownloadBestButton
        result={RESULT}
        outputMode="mp4"
        downloadBusy={false}
        loading={false}
        onDownload={vi.fn()}
      />,
    );
    expect(screen.getByTestId('download-button')).toBeInTheDocument();

    render(
      <QualityResultRow
        quality={QUALITY}
        isBest
        bestQuality={QUALITY}
        showCompare={false}
        downloadBusy={false}
        loading={false}
        downloadFormatId="0"
        onHoverChange={vi.fn()}
        onDownload={vi.fn()}
      />,
    );
    expect(screen.getByTestId('quality-row-0')).toBeInTheDocument();
    expect(screen.getByTestId('quality-row-status-0')).toHaveAttribute(
      'data-status',
      'downloading',
    );
    expect(screen.getByTestId('quality-download-0')).toBeInTheDocument();
  });

  it('marks the MP3 fallback row, success path, and error', () => {
    render(
      <QualityResultsPanel
        result={RESULT}
        outputMode="mp3"
        downloadBusy={false}
        loading={false}
        hoveredFormatId={null}
        downloadFormatId={undefined}
        onHoverChange={vi.fn()}
        onDownloadQuality={vi.fn()}
      />,
    );
    expect(screen.getByTestId('quality-row-mp3-fallback')).toBeInTheDocument();
    expect(
      screen.getByTestId('quality-row-status-mp3-fallback'),
    ).toHaveAttribute('data-status', 'ready');
    expect(
      screen.getByTestId('quality-download-mp3-fallback'),
    ).toBeInTheDocument();

    const savedPath = 'C:\\Out\\song.mp3';
    render(
      <SaveMessageBanner
        downloadNote={`Saved to ${savedPath}`}
        savedPath={savedPath}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByTestId('download-success')).toBeInTheDocument();
    expect(screen.getByTestId('download-saved-path')).toHaveAttribute(
      'data-saved-path',
      savedPath,
    );

    render(
      <AnalyzeErrorBanner
        error="Could not save"
        diagnosticsReport={undefined}
        onCopyReport={vi.fn()}
        reportCopied={false}
      />,
    );
    expect(screen.getByTestId('error-state')).toHaveTextContent(
      'Could not save',
    );
  });

  it('marks progress, the settings folder, and a queue row status', () => {
    render(
      <DownloadProgressCard
        progress={{
          active: true,
          percent: 10,
          speedLabel: '',
          etaLabel: '',
          sizeLabel: '',
          stage: 'downloading',
        }}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByTestId('download-progress')).toHaveAttribute(
      'data-status',
      'downloading',
    );

    setLastOutputFolder('C:\\Users\\me\\Downloads');
    render(
      <SettingsPage
        embedded
        defaultOutputMode="mp4"
        onDefaultOutputModeChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('output-folder')).toHaveTextContent(
      'C:\\Users\\me\\Downloads',
    );

    render(
      <QueueJobRow
        job={{
          id: 'job-1',
          orderIndex: 0,
          submittedUrl: 'https://www.youtube.com/watch?v=a',
          createdAt: 0,
          phase: 'terminal',
          status: 'Complete',
          terminal: 'complete',
          progress: {
            percent: 100,
            speedLabel: '',
            etaLabel: '',
            sizeLabel: '',
            stage: 'done',
          },
        }}
        isActive={false}
        disableMoveUp
        disableMoveDown
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByTestId('queue-row-status-job-1')).toHaveAttribute(
      'data-status',
      'complete',
    );
  });

  it('exposes the format picker when rendered on its own', () => {
    render(<OutputFormatSelect value="mp4" onChange={vi.fn()} />);
    expect(screen.getByTestId('format-picker')).toHaveValue('mp4');
  });
});
