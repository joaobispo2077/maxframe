import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';

/**
 * Dark "neon on graphite" shell (Chakra tokens + global chrome only).
 * Decision: Chakra-only (no Tailwind) for a thinner stack — see specs/active/video-pipeline/plan.md.
 */
export const maxframeSystem = createSystem(
  defaultConfig,
  defineConfig({
    globalCss: {
      body: {
        margin: 0,
        minHeight: '100vh',
        bg: '#070b12',
        color: '#e8f6ff',
        fontFamily:
          'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        backgroundImage:
          'linear-gradient(180deg, rgba(0, 240, 255, 0.04) 0%, transparent 38%), radial-gradient(1200px 600px at 50% -10%, rgba(255, 45, 149, 0.08), transparent 55%)',
      },
      '#root': {
        minHeight: '100vh',
      },
    },
  }),
);
