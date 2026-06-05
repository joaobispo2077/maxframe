import { type ReactElement } from 'react';

import { ChakraProvider } from '@chakra-ui/react';
import { fireEvent, render as rtlRender, screen } from '@testing-library/react';
import { PageHeader } from '@ui/components/PageHeader';
import { maxframeSystem } from '@ui/theme/maxframeTheme';
import { describe, expect, it, vi } from 'vitest';

function render(ui: ReactElement) {
  return rtlRender(
    <ChakraProvider value={maxframeSystem}>{ui}</ChakraProvider>,
  );
}

describe('PageHeader', () => {
  it('calls onGoHome when the logo is clicked', () => {
    const onGoHome = vi.fn();
    render(
      <PageHeader
        isPortable={false}
        subtitle="Test subtitle"
        onGoHome={onGoHome}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /go to homepage/i }));

    expect(onGoHome).toHaveBeenCalledTimes(1);
  });

  it('renders logo without a button when onGoHome is omitted', () => {
    render(<PageHeader isPortable={false} subtitle="Test subtitle" />);

    expect(screen.queryByRole('button', { name: /go to homepage/i })).toBeNull();
    expect(screen.getByAltText('Maxframe logo')).toBeInTheDocument();
  });
});
