import { type ReactElement } from 'react';

import { ChakraProvider } from '@chakra-ui/react';
import { fireEvent, render as rtlRender, screen } from '@testing-library/react';
import { AppNav } from '@ui/components/AppNav';
import { maxframeSystem } from '@ui/theme/maxframeTheme';
import { describe, expect, it, vi } from 'vitest';

function render(ui: ReactElement) {
  return rtlRender(
    <ChakraProvider value={maxframeSystem}>{ui}</ChakraProvider>,
  );
}

describe('AppNav', () => {
  it('renders tablist with Analyze, Queue, and Settings tabs', () => {
    render(<AppNav activeTab="analyze" onChange={vi.fn()} />);

    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Analyze' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Queue' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
    expect(screen.getByRole('tab', { name: 'Settings' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('calls onChange when a tab is clicked', () => {
    const onChange = vi.fn();
    render(<AppNav activeTab="analyze" onChange={onChange} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Queue' }));

    expect(onChange).toHaveBeenCalledWith('queue');
  });
});
