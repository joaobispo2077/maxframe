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
      'rgba(168, 85, 247, 0.08)',
    );
    expect(config.globalCss['#root'].minHeight).toBe('100vh');
    expect(config.globalCss['#root'].color).toBe('fg');
  });

  it('overrides semantic tokens for fg, border, and queue colors', () => {
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

    expect(colors.queue).toMatchObject({
      panel: {
        value: {
          _light: '{colors.gray.50}',
          _dark: 'rgba(255, 255, 255, 0.03)',
        },
      },
      rowActive: {
        value: {
          _light: '{colors.cyan.50}',
          _dark: 'rgba(0, 240, 255, 0.07)',
        },
      },
      rail: {
        value: {
          _light: '{colors.cyan.500}',
          _dark: '#00f0ff',
        },
      },
    });
  });

  it('defines purple-led brand and surface semantic tokens', () => {
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

    expect(colors.brand).toMatchObject({
      primary: {
        value: { _dark: '{colors.purple.500}' },
      },
      secondary: {
        value: { _dark: '#00f0ff' },
      },
      glow: {
        value: { _dark: 'rgba(168, 85, 247, 0.22)' },
      },
    });
    expect(colors.surface).toMatchObject({
      canvas: {
        value: { _dark: '#070b12' },
      },
      panel: {
        value: { _dark: '#0f141c' },
      },
      elevated: {
        value: { _dark: '#1E1B4B' },
      },
    });
    expect(colors.focus).toMatchObject({
      ring: {
        value: { _dark: '{colors.purple.400}' },
      },
    });
  });

  it('defines queue typography text styles', () => {
    const config = (maxframeSystem as { _config: Record<string, unknown> })
      ._config as {
      theme: {
        textStyles: Record<
          string,
          { value: Record<string, string | number | undefined> }
        >;
      };
    };

    expect(config.theme.textStyles.queueTitle.value.color).toBe('fg');
    expect(config.theme.textStyles.queueTitle.value.fontWeight).toBe(
      'semibold',
    );
    expect(config.theme.textStyles.queueMeta.value.color).toBe('fg.muted');
    expect(config.theme.textStyles.queueNumeric.value.fontVariantNumeric).toBe(
      'tabular-nums',
    );
  });
});
