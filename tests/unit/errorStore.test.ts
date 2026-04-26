import { beforeEach, describe, expect, it } from 'vitest';

describe('errorStore', () => {
  beforeEach(async () => {
    // Re-import fresh module each test to reset module-level state
    vi.resetModules();
  });

  it('getLastError returns undefined by default', async () => {
    const { getLastError } = await import('@src/interface/ipc/errorStore.js');
    expect(getLastError()).toBeUndefined();
  });

  it('recordError stores the error message', async () => {
    const { recordError, getLastError } = await import(
      '@src/interface/ipc/errorStore.js'
    );
    recordError('boom');
    expect(getLastError()).toBe('boom');
  });

  it('clearError resets the stored error', async () => {
    const { recordError, clearError, getLastError } = await import(
      '@src/interface/ipc/errorStore.js'
    );
    recordError('boom');
    clearError();
    expect(getLastError()).toBeUndefined();
  });

  it('second recordError overwrites the first', async () => {
    const { recordError, getLastError } = await import(
      '@src/interface/ipc/errorStore.js'
    );
    recordError('first error');
    recordError('second error');
    expect(getLastError()).toBe('second error');
  });
});
