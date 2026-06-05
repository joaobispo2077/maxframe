import { type ReactElement } from 'react';

import { ChakraProvider } from '@chakra-ui/react';
import { render as rtlRender, screen } from '@testing-library/react';
import { TitleBar } from '@ui/components/TitleBar';
import { maxframeSystem } from '@ui/theme/maxframeTheme';
import { describe, expect, it } from 'vitest';

function render(ui: ReactElement) {
  return rtlRender(
    <ChakraProvider value={maxframeSystem}>{ui}</ChakraProvider>,
  );
}

describe('TitleBar', () => {
  it('renders a drag region when height is positive', () => {
    render(<TitleBar height={40} padLeft={0} padRight={140} />);

    const bar = screen.getByTestId('title-bar-drag-region');
    expect(bar).toHaveStyle({ height: '40px', position: 'fixed' });
    expect((bar as HTMLElement).style.WebkitAppRegion).toBe('drag');
  });

  it('renders nothing when height is zero', () => {
    const { container } = render(
      <TitleBar height={0} padLeft={0} padRight={0} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
