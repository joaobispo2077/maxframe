import { type ReactElement } from 'react';

import { ChakraProvider } from '@chakra-ui/react';
import { fireEvent, render as rtlRender, screen } from '@testing-library/react';
import { setLastOutputFolder } from '@ui/lib/appPreferences';
import { SettingsPage } from '@ui/pages/SettingsPage';
import { maxframeSystem } from '@ui/theme/maxframeTheme';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function render(ui: ReactElement) {
  return rtlRender(
    <ChakraProvider value={maxframeSystem}>{ui}</ChakraProvider>,
  );
}

describe('SettingsPage preferences', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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
      getLogPath: vi
        .fn()
        .mockResolvedValue('C:\\AppData\\Maxframe\\maxframe-debug.log'),
      showItemInFolder: vi.fn(),
    };
  });

  it('shows last output folder when saved', () => {
    setLastOutputFolder('C:\\Users\\me\\Downloads');
    render(
      <SettingsPage
        embedded
        defaultOutputMode="mp4"
        onDefaultOutputModeChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/C:\\Users\\me\\Downloads/)).toBeInTheDocument();
  });

  it('calls onDefaultOutputModeChange when default format changes', () => {
    const onChange = vi.fn();
    render(
      <SettingsPage
        embedded
        defaultOutputMode="mp4"
        onDefaultOutputModeChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText('Default output format'), {
      target: { value: 'mp3' },
    });

    expect(onChange).toHaveBeenCalledWith('mp3');
  });
});
