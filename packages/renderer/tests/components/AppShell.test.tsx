import { type ReactElement } from 'react';

import { ChakraProvider, Text } from '@chakra-ui/react';
import { render as rtlRender, screen } from '@testing-library/react';
import { AppShell } from '@ui/components/AppShell';
import { maxframeSystem } from '@ui/theme/maxframeTheme';
import { describe, expect, it } from 'vitest';

function render(ui: ReactElement) {
  return rtlRender(
    <ChakraProvider value={maxframeSystem}>{ui}</ChakraProvider>,
  );
}

describe('AppShell', () => {
  it('renders Maxframe heading and logo', () => {
    render(
      <AppShell isPortable={false} subtitle="Test subtitle">
        <Text>Child content</Text>
      </AppShell>,
    );

    expect(
      screen.getByRole('heading', { name: 'Maxframe' }),
    ).toBeInTheDocument();
    expect(screen.getByAltText('Maxframe logo')).toBeInTheDocument();
    expect(screen.getByText('Test subtitle')).toBeInTheDocument();
  });

  it('shows portable badge when isPortable is true', () => {
    render(
      <AppShell isPortable={true} subtitle="Portable mode">
        <Text>Child</Text>
      </AppShell>,
    );

    expect(screen.getByText('Portable')).toBeInTheDocument();
  });

  it('renders children inside the panel', () => {
    render(
      <AppShell isPortable={false} subtitle="Subtitle">
        <Text>Panel child</Text>
      </AppShell>,
    );

    expect(screen.getByText('Panel child')).toBeInTheDocument();
  });
});
