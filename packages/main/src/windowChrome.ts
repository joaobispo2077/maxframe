import type { BrowserWindowConstructorOptions } from 'electron';

/** Matches `surface.canvas` in the renderer design system. */
export const WINDOW_CANVAS_COLOR = '#070b12';

export type TitleBarInset = {
  height: number;
  padLeft: number;
  /** Reserves space for overlaid window controls (Windows). */
  padRight: number;
};

export function getTitleBarInset(platform: NodeJS.Platform = process.platform): TitleBarInset {
  if (platform === 'win32') {
    return { height: 40, padLeft: 0, padRight: 140 };
  }

  if (platform === 'darwin') {
    return { height: 38, padLeft: 72, padRight: 0 };
  }

  return { height: 0, padLeft: 0, padRight: 0 };
}

export function getBrowserWindowChromeOptions(
  platform: NodeJS.Platform = process.platform,
): Pick<
  BrowserWindowConstructorOptions,
  'backgroundColor' | 'titleBarStyle' | 'titleBarOverlay' | 'trafficLightPosition'
> {
  const base = { backgroundColor: WINDOW_CANVAS_COLOR };

  if (platform === 'win32') {
    const inset = getTitleBarInset(platform);
    return {
      ...base,
      titleBarStyle: 'hidden',
      titleBarOverlay: {
        color: WINDOW_CANVAS_COLOR,
        symbolColor: '#F8FAFC',
        height: inset.height,
      },
    };
  }

  if (platform === 'darwin') {
    return {
      ...base,
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 14, y: 14 },
    };
  }

  return base;
}
