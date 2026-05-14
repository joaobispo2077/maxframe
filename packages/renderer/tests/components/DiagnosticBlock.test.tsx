import type { DiagnosticsReport } from '@ui/maxframe-api';

import { type ReactElement } from 'react';

import { ChakraProvider } from '@chakra-ui/react';
import { fireEvent, render as rtlRender, screen } from '@testing-library/react';
import { DiagnosticBlock } from '@ui/components/DiagnosticBlock';
import { maxframeSystem } from '@ui/theme/maxframeTheme';
import { describe, expect, it, vi } from 'vitest';

function render(ui: ReactElement) {
  return rtlRender(
    <ChakraProvider value={maxframeSystem}>{ui}</ChakraProvider>,
  );
}

const REPORT: DiagnosticsReport = {
  ytdlpPath: 'yt-dlp',
  ytdlpFound: false,
  ffmpegPath: 'ffmpeg',
  ffmpegFound: false,
  platform: 'win32',
  arch: 'x64',
  appVersion: '1.0.1',
  pathEnv: 'C:\\Windows\\system32',
  lastError: 'yt-dlp failed',
};

describe('DiagnosticBlock', () => {
  it('renders the yt-dlp path value', () => {
    render(<DiagnosticBlock report={REPORT} onCopy={vi.fn()} copied={false} />);
    expect(screen.getByText('yt-dlp')).toBeInTheDocument();
  });

  it('renders the ffmpeg path value', () => {
    render(<DiagnosticBlock report={REPORT} onCopy={vi.fn()} copied={false} />);
    expect(screen.getByText('ffmpeg')).toBeInTheDocument();
  });

  it('shows NOT FOUND text when ytdlpFound is false', () => {
    render(<DiagnosticBlock report={REPORT} onCopy={vi.fn()} copied={false} />);
    const notFoundBadges = screen.getAllByText('NOT FOUND');
    expect(notFoundBadges.length).toBeGreaterThan(0);
  });

  it('shows FOUND badge when ytdlpFound is true', () => {
    const foundReport: DiagnosticsReport = {
      ...REPORT,
      ytdlpFound: true,
    };
    render(
      <DiagnosticBlock report={foundReport} onCopy={vi.fn()} copied={false} />,
    );
    expect(screen.getByText('FOUND')).toBeInTheDocument();
  });

  it('calls onCopy when Copy report button is clicked', () => {
    const onCopy = vi.fn();
    render(<DiagnosticBlock report={REPORT} onCopy={onCopy} copied={false} />);

    fireEvent.click(screen.getByRole('button', { name: /copy report/i }));
    expect(onCopy).toHaveBeenCalledOnce();
  });

  it('shows "Copied!" text when copied is true', () => {
    render(<DiagnosticBlock report={REPORT} onCopy={vi.fn()} copied={true} />);
    expect(screen.getByText('Copied!')).toBeInTheDocument();
  });

  it('shows the last error message', () => {
    render(<DiagnosticBlock report={REPORT} onCopy={vi.fn()} copied={false} />);
    expect(screen.getByText('yt-dlp failed')).toBeInTheDocument();
  });

  it('does not render last error section when lastError is undefined', () => {
    const noErrorReport: DiagnosticsReport = {
      ...REPORT,
      lastError: undefined,
    };
    render(
      <DiagnosticBlock
        report={noErrorReport}
        onCopy={vi.fn()}
        copied={false}
      />,
    );
    expect(screen.queryByText('Last error:')).not.toBeInTheDocument();
  });
});
