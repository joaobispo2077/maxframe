import type { YtdlpUpdateView } from '@src/domain/ytdlp/ytdlpUpdateView';

import { type ReactElement } from 'react';

import { ChakraProvider } from '@chakra-ui/react';
import {
  YTDLP_NOT_NOW_BUTTON,
  YTDLP_TRY_AGAIN_BUTTON,
  YTDLP_UPDATE_BUTTON,
  YTDLP_UPDATING_BUTTON,
  ytdlpChecksumFailureMessage,
  ytdlpFallbackMessage,
  ytdlpNetworkFailureMessage,
  ytdlpOutdatedMessage,
  ytdlpUpdatedMessage,
  ytdlpUpdatingLiveMessage,
  ytdlpWriteFailureMessage,
} from '@src/domain/ytdlp/ytdlpUpdateCopy';
import { fireEvent, render as rtlRender, screen } from '@testing-library/react';
import { YtdlpUpdateBanner } from '@ui/components/YtdlpUpdateBanner';
import { maxframeSystem } from '@ui/theme/maxframeTheme';
import { describe, expect, it, vi } from 'vitest';

function render(ui: ReactElement) {
  return rtlRender(
    <ChakraProvider value={maxframeSystem}>{ui}</ChakraProvider>,
  );
}

function view(overrides: Partial<YtdlpUpdateView>): YtdlpUpdateView {
  return {
    version: '2026.03.17',
    source: 'bundled',
    phase: 'idle',
    current: '2026.03.17',
    latest: '2026.08.19',
    bundled: '2026.03.17',
    manualCheckEnabled: false,
    showLaunchDisclosure: true,
    updateAllowed: true,
    ...overrides,
  };
}

describe('YtdlpUpdateBanner', () => {
  it('shows the outdated warning and keeps the buttons reachable', () => {
    const onUpdate = vi.fn();
    const onDismiss = vi.fn();
    render(
      <YtdlpUpdateBanner
        view={view({ phase: 'outdated' })}
        blocked={false}
        onUpdate={onUpdate}
        onDismiss={onDismiss}
        onCheck={vi.fn()}
      />,
    );
    expect(
      screen.getByText(ytdlpOutdatedMessage('2026.03.17', '2026.08.19')),
    ).toBeInTheDocument();
    const update = screen.getByRole('button', { name: YTDLP_UPDATE_BUTTON });
    const later = screen.getByRole('button', { name: YTDLP_NOT_NOW_BUTTON });
    update.focus();
    expect(update).toHaveFocus();
    later.focus();
    expect(later).toHaveFocus();
    fireEvent.click(update);
    fireEvent.click(later);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('announces the update and ignores clicks while it is held', () => {
    const onUpdate = vi.fn();
    render(
      <YtdlpUpdateBanner
        view={view({ phase: 'updating' })}
        blocked
        onUpdate={onUpdate}
        onDismiss={vi.fn()}
        onCheck={vi.fn()}
      />,
    );
    expect(screen.getByTestId('ytdlp-update-live')).toHaveTextContent(
      ytdlpUpdatingLiveMessage('2026.08.19'),
    );
    const button = screen.getByRole('button', { name: YTDLP_UPDATING_BUTTON });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(button);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('shows the failure strings with Try again and the fallback message', () => {
    const onUpdate = vi.fn();
    const { rerender } = render(
      <YtdlpUpdateBanner
        view={view({ phase: 'error-network' })}
        blocked={false}
        onUpdate={onUpdate}
        onDismiss={vi.fn()}
        onCheck={vi.fn()}
      />,
    );
    expect(
      screen.getByText(ytdlpNetworkFailureMessage('2026.03.17')),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: YTDLP_TRY_AGAIN_BUTTON }),
    );
    expect(onUpdate).toHaveBeenCalledTimes(1);

    rerender(
      <ChakraProvider value={maxframeSystem}>
        <YtdlpUpdateBanner
          view={view({ phase: 'error-checksum' })}
          blocked={false}
          onUpdate={onUpdate}
          onDismiss={vi.fn()}
          onCheck={vi.fn()}
        />
      </ChakraProvider>,
    );
    expect(
      screen.getByText(ytdlpChecksumFailureMessage('2026.03.17')),
    ).toBeInTheDocument();

    rerender(
      <ChakraProvider value={maxframeSystem}>
        <YtdlpUpdateBanner
          view={view({ phase: 'error-write' })}
          blocked={false}
          onUpdate={onUpdate}
          onDismiss={vi.fn()}
          onCheck={vi.fn()}
        />
      </ChakraProvider>,
    );
    expect(
      screen.getByText(ytdlpWriteFailureMessage('2026.03.17')),
    ).toBeInTheDocument();

    rerender(
      <ChakraProvider value={maxframeSystem}>
        <YtdlpUpdateBanner
          view={view({ phase: 'fallback' })}
          blocked={false}
          onUpdate={onUpdate}
          onDismiss={vi.fn()}
          onCheck={vi.fn()}
        />
      </ChakraProvider>,
    );
    expect(
      screen.getByText(ytdlpFallbackMessage('2026.03.17')),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: YTDLP_NOT_NOW_BUTTON }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: YTDLP_UPDATE_BUTTON }));
    expect(onUpdate).toHaveBeenCalledTimes(2);
  });

  it('shows success and up to date without an install button', () => {
    const { rerender } = render(
      <YtdlpUpdateBanner
        view={view({
          phase: 'success',
          current: '2026.08.19',
          version: '2026.08.19',
        })}
        blocked={false}
        onUpdate={vi.fn()}
        onDismiss={vi.fn()}
        onCheck={vi.fn()}
      />,
    );
    expect(
      screen.getByText(ytdlpUpdatedMessage('2026.08.19')),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: YTDLP_UPDATE_BUTTON }),
    ).not.toBeInTheDocument();

    rerender(
      <ChakraProvider value={maxframeSystem}>
        <YtdlpUpdateBanner
          view={view({ phase: 'up-to-date', current: '2026.08.19' })}
          blocked={false}
          onUpdate={vi.fn()}
          onDismiss={vi.fn()}
          onCheck={vi.fn()}
        />
      </ChakraProvider>,
    );
    expect(
      screen.getByText('yt-dlp is up to date (2026.08.19).'),
    ).toBeInTheDocument();
  });

  it('retries a manual check from the failure message', () => {
    const onCheck = vi.fn();
    render(
      <YtdlpUpdateBanner
        view={view({ phase: 'check-failed', latest: undefined })}
        blocked={false}
        onUpdate={vi.fn()}
        onDismiss={vi.fn()}
        onCheck={onCheck}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: YTDLP_TRY_AGAIN_BUTTON }),
    );
    expect(onCheck).toHaveBeenCalledTimes(1);
  });

  it('renders nothing while idle', () => {
    const { container } = render(
      <YtdlpUpdateBanner
        view={view({ phase: 'idle' })}
        blocked={false}
        onUpdate={vi.fn()}
        onDismiss={vi.fn()}
        onCheck={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
