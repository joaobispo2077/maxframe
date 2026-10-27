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
  lastErrorDetail: undefined,
  lastSubmittedUrl: undefined,
  ytdlpVersion: undefined,
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

  it('shows Missing text when ytdlpFound is false', () => {
    render(<DiagnosticBlock report={REPORT} onCopy={vi.fn()} copied={false} />);
    const notFoundBadges = screen.getAllByText('Missing');
    expect(notFoundBadges.length).toBeGreaterThan(0);
  });

  it('shows Found badge when ytdlpFound is true', () => {
    const foundReport: DiagnosticsReport = {
      ...REPORT,
      ytdlpFound: true,
    };
    render(
      <DiagnosticBlock report={foundReport} onCopy={vi.fn()} copied={false} />,
    );
    expect(screen.getByText('Found')).toBeInTheDocument();
  });

  it('calls onCopy when Copy report button is clicked', () => {
    const onCopy = vi.fn();
    render(<DiagnosticBlock report={REPORT} onCopy={onCopy} copied={false} />);

    fireEvent.click(screen.getByRole('button', { name: /copy report/i }));
    expect(onCopy).toHaveBeenCalledOnce();
  });

  it('shows "Copied" text when copied is true', () => {
    render(<DiagnosticBlock report={REPORT} onCopy={vi.fn()} copied={true} />);
    expect(screen.getByText('Copied')).toBeInTheDocument();
  });

  it('shows the last error message', () => {
    render(<DiagnosticBlock report={REPORT} onCopy={vi.fn()} copied={false} />);
    expect(screen.getByText('yt-dlp failed')).toBeInTheDocument();
  });

  it('shows platform, app version, and yt-dlp version on one line', () => {
    render(<DiagnosticBlock report={REPORT} onCopy={vi.fn()} copied={false} />);
    expect(screen.getByTestId('diagnostic-versions')).toHaveTextContent(
      'Platform: win32 (x64) · App: 1.0.1 · yt-dlp: (unknown)',
    );

    render(
      <DiagnosticBlock
        report={{ ...REPORT, ytdlpVersion: '2026.08.19' }}
        onCopy={vi.fn()}
        copied={false}
      />,
    );
    expect(screen.getByText(/yt-dlp: 2026\.08\.19/)).toBeInTheDocument();
  });

  it('masks Windows user folders and explains what the report leaves out', () => {
    render(
      <DiagnosticBlock
        report={{
          ...REPORT,
          ytdlpPath: 'C:\\Users\\Joao\\AppData\\yt-dlp.exe',
          ffmpegPath: 'C:/Users/Joao/ffmpeg.exe',
          lastError: 'USERPROFILE=C:\\Users\\Joao',
        }}
        onCopy={vi.fn()}
        copied={false}
      />,
    );
    expect(
      screen.getByText('C:\\Users\\<user>\\AppData\\yt-dlp.exe'),
    ).toBeInTheDocument();
    expect(screen.getByText('C:/Users/<user>/ffmpeg.exe')).toBeInTheDocument();
    expect(
      screen.getByText('USERPROFILE=C:\\Users\\<user>'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Joao/)).not.toBeInTheDocument();
    expect(
      screen.getByText(
        'Your Windows user name and PATH are left out of this report.',
      ),
    ).toBeInTheDocument();
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
