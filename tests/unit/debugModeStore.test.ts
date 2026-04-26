import { beforeEach, describe, expect, it } from 'vitest';

describe('debugModeStore', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('isDebugModeActive is false by default', async () => {
    const { isDebugModeActive } = await import(
      '@src/interface/ipc/debugModeStore.js'
    );
    expect(isDebugModeActive()).toBe(false);
  });

  it('setDebugMode(true) makes isDebugModeActive return true', async () => {
    const { setDebugMode, isDebugModeActive } = await import(
      '@src/interface/ipc/debugModeStore.js'
    );
    setDebugMode(true);
    expect(isDebugModeActive()).toBe(true);
  });

  it('setDebugMode(false) makes isDebugModeActive return false', async () => {
    const { setDebugMode, isDebugModeActive } = await import(
      '@src/interface/ipc/debugModeStore.js'
    );
    setDebugMode(true);
    setDebugMode(false);
    expect(isDebugModeActive()).toBe(false);
  });
});
