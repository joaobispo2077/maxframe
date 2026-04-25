import { maxframeSystem } from '@ui/theme/maxframeTheme';
import { describe, expect, it } from 'vitest';

describe('maxframeTheme', () => {
  it('defines dark global shell chrome', () => {
    const config = (maxframeSystem as { _config: Record<string, unknown> })
      ._config as {
      globalCss: Record<string, Record<string, string | number>>;
    };

    expect(config.globalCss.html.colorScheme).toBe('dark');
    expect(config.globalCss.body.minHeight).toBe('100vh');
    expect(config.globalCss.body.bg).toBe('#070b12');
    expect(config.globalCss.body.color).toBe('#f0f6fc');
    expect(config.globalCss.body.margin).toBe(0);
    expect(config.globalCss.body.fontFamily).toBe(
      'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    );
    expect(config.globalCss.body.backgroundImage).toContain(
      'linear-gradient(180deg',
    );
    expect(config.globalCss.body.backgroundImage).toContain(
      'rgba(255, 45, 149, 0.08)',
    );
    expect(config.globalCss['#root'].minHeight).toBe('100vh');
    expect(config.globalCss['#root'].color).toBe('fg');
  });

  it('overrides semantic tokens for fg and border colors', () => {
    const config = (maxframeSystem as { _config: Record<string, unknown> })
      ._config as {
      theme: {
        semanticTokens: {
          colors: Record<
            string,
            Record<string, { value: Record<string, string> }>
          >;
        };
      };
    };
    const colors = config.theme.semanticTokens.colors;

    expect(colors.fg).toMatchObject({
      DEFAULT: {
        value: { _light: '{colors.black}', _dark: '#f1f7fd' },
      },
      muted: {
        value: {
          _light: '{colors.gray.600}',
          _dark: 'rgba(200, 220, 240, 0.92)',
        },
      },
    });
    expect(colors.border).toMatchObject({
      DEFAULT: {
        value: {
          _light: '{colors.gray.200}',
          _dark: 'rgba(255, 255, 255, 0.2)',
        },
      },
    });
  });
});
