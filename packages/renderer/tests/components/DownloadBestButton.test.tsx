import { type ReactElement } from 'react';

import { ChakraProvider } from '@chakra-ui/react';
import { fireEvent, render as rtlRender, screen } from '@testing-library/react';
import { DownloadBestButton } from '@ui/components/DownloadBestButton';
import { maxframeSystem } from '@ui/theme/maxframeTheme';
import { describe, expect, it, vi } from 'vitest';

function render(ui: ReactElement) {
  return rtlRender(
    <ChakraProvider value={maxframeSystem}>{ui}</ChakraProvider>,
  );
}

const RESULT = {
  url: 'https://www.youtube.com/watch?v=vid',
  videoId: 'vid',
  title: 'T',
  uploader: 'U',
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
  audioQualities: [],
};

describe('DownloadBestButton', () => {
  it('renders purple download-best CTA for mp4', () => {
    const onDownload = vi.fn();
    render(
      <DownloadBestButton
        result={RESULT}
        outputMode="mp4"
        downloadBusy={false}
        loading={false}
        onDownload={onDownload}
      />,
    );

    const button = screen.getByRole('button', {
      name: /download best mp4/i,
    });
    fireEvent.click(button);
    expect(onDownload).toHaveBeenCalledWith('137', false);
  });
});
