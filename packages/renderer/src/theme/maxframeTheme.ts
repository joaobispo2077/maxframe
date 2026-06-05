import {
  createSystem,
  defaultConfig,
  defineConfig,
  defineSemanticTokens,
} from '@chakra-ui/react';

/**
 * Brighter `fg` / `fg.muted` in _dark so body text, headings, and helper copy
 * stay legible on #070b12 / #0f141c (Chakra's default `fg.muted` is too dim here).
 */
const maxframeSemColors = defineSemanticTokens.colors({
  fg: {
    DEFAULT: {
      value: { _light: '{colors.black}', _dark: '#f1f7fd' },
    },
    muted: {
      value: {
        _light: '{colors.gray.600}',
        _dark: 'rgba(200, 220, 240, 0.92)',
      },
    },
  },
  border: {
    DEFAULT: {
      value: { _light: '{colors.gray.200}', _dark: 'rgba(255, 255, 255, 0.2)' },
    },
  },
  queue: {
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
  },
  brand: {
    primary: {
      value: { _light: '{colors.purple.600}', _dark: '{colors.purple.500}' },
    },
    secondary: {
      value: { _light: '{colors.cyan.500}', _dark: '#00f0ff' },
    },
    glow: {
      value: { _dark: 'rgba(168, 85, 247, 0.22)' },
    },
  },
  surface: {
    canvas: {
      value: { _dark: '#070b12' },
    },
    panel: {
      value: { _dark: '#0f141c' },
    },
    elevated: {
      value: { _dark: '#1E1B4B' },
    },
  },
  focus: {
    ring: {
      value: { _dark: '{colors.purple.400}' },
    },
  },
});

/**
 * Dark "neon on graphite" shell (Chakra tokens + global chrome only).
 * Decision: Chakra-only (no Tailwind) for a thinner stack — see specs/active/video-pipeline/plan.md.
 */
export const maxframeSystem = createSystem(
  defaultConfig,
  defineConfig({
    globalCss: {
      html: {
        colorScheme: 'dark',
      },
      body: {
        margin: 0,
        minHeight: '100vh',
        bg: '#070b12',
        color: '#f0f6fc',
        fontFamily:
          'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        backgroundImage:
          'linear-gradient(180deg, rgba(0, 240, 255, 0.04) 0%, transparent 38%), radial-gradient(1200px 600px at 50% -10%, rgba(168, 85, 247, 0.08), transparent 55%)',
      },
      '#root': {
        minHeight: '100vh',
        color: 'fg',
      },
    },
    theme: {
      semanticTokens: {
        colors: maxframeSemColors,
      },
      textStyles: {
        queueTitle: {
          value: {
            fontWeight: 'semibold',
            fontSize: 'sm',
            lineHeight: 'short',
            color: 'fg',
          },
        },
        queueMeta: {
          value: {
            fontSize: 'xs',
            lineHeight: 'short',
            color: 'fg.muted',
          },
        },
        queueNumeric: {
          value: {
            fontSize: 'xs',
            lineHeight: 'short',
            fontVariantNumeric: 'tabular-nums',
            color: 'fg.muted',
          },
        },
      },
    },
  }),
);
