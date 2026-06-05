import { type ReactElement } from 'react';

import { ChakraProvider } from '@chakra-ui/react';
import { fireEvent, render as rtlRender, screen } from '@testing-library/react';
import { OutputFormatSelect } from '@ui/components/OutputFormatSelect';
import { maxframeSystem } from '@ui/theme/maxframeTheme';
import { describe, expect, it, vi } from 'vitest';

function render(ui: ReactElement) {
  return rtlRender(
    <ChakraProvider value={maxframeSystem}>{ui}</ChakraProvider>,
  );
}

describe('OutputFormatSelect', () => {
  it('renders MP4 and MP3 options with accessible label', () => {
    render(<OutputFormatSelect value="mp4" onChange={vi.fn()} />);

    const select = screen.getByLabelText('Output format') as HTMLSelectElement;
    expect(select.value).toBe('mp4');
    expect(screen.getByRole('option', { name: /mp4/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /mp3/i })).toBeInTheDocument();
  });

  it('calls onChange when MP3 is selected', () => {
    const onChange = vi.fn();
    render(<OutputFormatSelect value="mp4" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Output format'), {
      target: { value: 'mp3' },
    });

    expect(onChange).toHaveBeenCalledWith('mp3');
  });

  it('uses Chakra NativeSelect wrapper instead of inline-styled select', () => {
    const { container } = render(
      <OutputFormatSelect value="mp4" onChange={vi.fn()} />,
    );

    const select = container.querySelector('select');
    expect(select).toBeInTheDocument();
    expect(select?.getAttribute('style')).toBeNull();
  });
});
