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

  it('stores and clears technical detail alongside user message', async () => {
    const { recordError, clearError, getLastError, getLastErrorDetail } =
      await import('@src/interface/ipc/errorStore.js');
    recordError('Could not analyze this video right now.', 'network down');
    expect(getLastError()).toBe('Could not analyze this video right now.');
    expect(getLastErrorDetail()).toBe('network down');
    clearError();
    expect(getLastError()).toBeUndefined();
    expect(getLastErrorDetail()).toBeUndefined();
  });

  it('stores submitted URL until clearError', async () => {
    const {
      recordSubmittedUrl,
      getLastSubmittedUrl,
      clearError,
    } = await import('@src/interface/ipc/errorStore.js');
    recordSubmittedUrl(
      'https://www.youtube.com/watch?v=Zt62nsFLqA0&list=RDZt62nsFLqA0&start_radio=1',
    );
    expect(getLastSubmittedUrl()).toBe(
      'https://www.youtube.com/watch?v=Zt62nsFLqA0&list=RDZt62nsFLqA0&start_radio=1',
    );
    clearError();
    expect(getLastSubmittedUrl()).toBeUndefined();
  });
});
