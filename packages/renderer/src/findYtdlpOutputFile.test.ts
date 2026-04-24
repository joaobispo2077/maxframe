import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { findYtdlpOutputFile } from '../../../src/infrastructure/youtube/findYtdlpOutputFile.js';

describe('findYtdlpOutputFile', () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const d of dirs) {
      try {
        rmSync(d, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
    dirs.length = 0;
  });

  function tempDir(): string {
    const dir = join(tmpdir(), `mf-ytdlp-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    mkdirSync(dir, { recursive: true });
    dirs.push(dir);
    return dir;
  }

  it('returns a direct basename+extension match', () => {
    const dir = tempDir();
    writeFileSync(join(dir, 'clip.mp4'), '');
    expect(findYtdlpOutputFile(dir, 'clip')).toBe(join(dir, 'clip.mp4'));
  });

  it('prefers mp4 over mkv when both exist', () => {
    const dir = tempDir();
    writeFileSync(join(dir, 'clip.mkv'), '');
    writeFileSync(join(dir, 'clip.mp4'), '');
    expect(findYtdlpOutputFile(dir, 'clip')).toBe(join(dir, 'clip.mp4'));
  });

  it('finds a scan match when extension is nonstandard but prefix matches', () => {
    const dir = tempDir();
    writeFileSync(join(dir, 'clip.custom'), '');
    expect(findYtdlpOutputFile(dir, 'clip')).toBe(join(dir, 'clip.custom'));
  });

  it('ignores partial downloads', () => {
    const dir = tempDir();
    writeFileSync(join(dir, 'clip.mp4.part'), '');
    writeFileSync(join(dir, 'clip.webm'), '');
    expect(findYtdlpOutputFile(dir, 'clip')).toBe(join(dir, 'clip.webm'));
  });

  it('returns undefined when nothing matches', () => {
    const dir = tempDir();
    writeFileSync(join(dir, 'other.mp4'), '');
    expect(findYtdlpOutputFile(dir, 'clip')).toBeUndefined();
  });
});
