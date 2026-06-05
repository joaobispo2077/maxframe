import {
  getBrowserWindowChromeOptions,
  getTitleBarInset,
  WINDOW_CANVAS_COLOR,
} from '../../packages/main/src/windowChrome.js';
import { describe, expect, it } from 'vitest';

describe('windowChrome', () => {
  it('uses hidden title bar overlay on Windows', () => {
    const options = getBrowserWindowChromeOptions('win32');

    expect(options.backgroundColor).toBe(WINDOW_CANVAS_COLOR);
    expect(options.titleBarStyle).toBe('hidden');
    expect(options.titleBarOverlay).toEqual({
      color: WINDOW_CANVAS_COLOR,
      symbolColor: '#F8FAFC',
      height: 40,
    });
  });

  it('uses hidden inset title bar on macOS', () => {
    const options = getBrowserWindowChromeOptions('darwin');

    expect(options.titleBarStyle).toBe('hiddenInset');
    expect(options.trafficLightPosition).toEqual({ x: 14, y: 14 });
  });

  it('reserves right padding for Windows window controls', () => {
    expect(getTitleBarInset('win32').padRight).toBe(140);
  });

  it('returns zero inset for browser-like platforms', () => {
    expect(getTitleBarInset('linux')).toEqual({
      height: 0,
      padLeft: 0,
      padRight: 0,
    });
  });
});
