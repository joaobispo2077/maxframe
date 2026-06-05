import { type ReactElement } from 'react';

import { ChakraProvider } from '@chakra-ui/react';
import { render as rtlRender, screen } from '@testing-library/react';
import { VideoPreviewCard } from '@ui/components/VideoPreviewCard';
import { maxframeSystem } from '@ui/theme/maxframeTheme';
import { describe, expect, it } from 'vitest';

function render(ui: ReactElement) {
  return rtlRender(
    <ChakraProvider value={maxframeSystem}>{ui}</ChakraProvider>,
  );
}

const RESULT = {
  url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  videoId: 'dQw4w9WgXcQ',
  title: 'Never Gonna Give You Up',
  uploader: 'Rick Astley',
  qualities: [],
  audioQualities: [],
};

describe('VideoPreviewCard', () => {
  it('shows title, channel, and thumbnail region after analyze', () => {
    render(<VideoPreviewCard result={RESULT} />);

    expect(screen.getByRole('region', { name: 'video-preview' })).toBeInTheDocument();
    expect(screen.getByText('Never Gonna Give You Up')).toBeInTheDocument();
    expect(screen.getByText('Rick Astley')).toBeInTheDocument();
    expect(screen.getByText('dQw4w9WgXcQ')).toBeInTheDocument();
  });
});
