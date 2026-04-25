import { describe, expect, it } from 'vitest';

import { maxframeSystem } from '../../src/theme/maxframeTheme';

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
    expect(config.globalCss.body.backgroundImage).toContain(
      'linear-gradient(180deg',
    );
    expect(config.globalCss['#root'].minHeight).toBe('100vh');
    expect(config.globalCss['#root'].color).toBe('fg');
  });

  it('overrides semantic tokens for fg and border colors', () => {
    const config = (maxframeSystem as { _config: Record<string, unknown> })
      ._config as {
      theme: {
        semanticTokens: {
          colors: Record<string, Record<string, { value: Record<string, string> }>>;
        };
      };
    };
    const colors = config.theme.semanticTokens.colors;

    expect(colors.fg.DEFAULT.value._dark).toBe('#f1f7fd');
    expect(colors.fg.muted.value._dark).toBe('rgba(200, 220, 240, 0.92)');
    expect(colors.border.DEFAULT.value._dark).toBe('rgba(255, 255, 255, 0.2)');
    expect(colors.fg.DEFAULT.value._light).toBe('{colors.black}');
  });
});
