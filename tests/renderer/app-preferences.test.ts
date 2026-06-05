import {
  getDefaultOutputMode,
  parentFolderFromFilePath,
  setDefaultOutputMode,
  setLastOutputFolder,
  getLastOutputFolder,
} from '@ui/lib/appPreferences';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('appPreferences', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('defaults output mode to mp4', () => {
    expect(getDefaultOutputMode()).toBe('mp4');
  });

  it('persists default output mode', () => {
    setDefaultOutputMode('mp3');
    expect(getDefaultOutputMode()).toBe('mp3');
  });

  it('stores and reads last output folder', () => {
    setLastOutputFolder('C:\\Users\\me\\Downloads');
    expect(getLastOutputFolder()).toBe('C:\\Users\\me\\Downloads');
  });

  it('extracts parent folder from Windows file path', () => {
    expect(parentFolderFromFilePath('C:\\Videos\\song.mp4')).toBe(
      'C:\\Videos',
    );
  });
});
