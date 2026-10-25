import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  E2E_FIXTURE_ENV,
  E2E_OUTPUT_DIR_ENV,
  E2E_TEST_MODE_ENV,
  E2eTestHookError,
  resolveE2eFixture,
  resolveE2eOutputDir,
  resolveYtdlpMediaUrl,
} from '@src/infrastructure/e2e/e2eTestHook.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const WATCH_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const ENV_KEYS = [E2E_TEST_MODE_ENV, E2E_FIXTURE_ENV, E2E_OUTPUT_DIR_ENV];

function clearE2eEnv(): void {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
}

function fsKind(kind: 'file' | 'directory' | 'missing') {
  return {
    stat: () => {
      if (kind === 'missing') {
        throw new Error('ENOENT');
      }
      return {
        isFile: () => kind === 'file',
        isDirectory: () => kind === 'directory',
      };
    },
  };
}

describe('e2e test hook gating', () => {
  let root: string;

  beforeEach(() => {
    clearE2eEnv();
    root = mkdtempSync(join(tmpdir(), 'maxframe-e2e-hook-'));
  });

  afterEach(() => {
    clearE2eEnv();
    rmSync(root, { recursive: true, force: true });
  });

  it('names the environment variables the packaged exe reads', () => {
    expect(E2E_TEST_MODE_ENV).toBe('MAXFRAME_E2E');
    expect(E2E_FIXTURE_ENV).toBe('MAXFRAME_E2E_FIXTURE');
    expect(E2E_OUTPUT_DIR_ENV).toBe('MAXFRAME_E2E_OUTPUT_DIR');
  });

  it('stays off when test mode is missing, blank, or not exactly 1', () => {
    const fixture = join(root, 'clip.mp4');
    writeFileSync(fixture, 'x');
    process.env[E2E_FIXTURE_ENV] = fixture;

    expect(resolveYtdlpMediaUrl(WATCH_URL)).toBe(WATCH_URL);

    process.env[E2E_TEST_MODE_ENV] = 'true';
    expect(resolveE2eFixture().active).toBe(false);

    process.env[E2E_TEST_MODE_ENV] = ' 1';
    expect(resolveE2eFixture().active).toBe(false);

    process.env[E2E_TEST_MODE_ENV] = '1';
    delete process.env[E2E_FIXTURE_ENV];
    expect(resolveYtdlpMediaUrl(WATCH_URL)).toBe(WATCH_URL);

    process.env[E2E_FIXTURE_ENV] = '   ';
    expect(resolveE2eFixture()).toEqual({ active: false });
  });

  it('uses a trimmed absolute path only in test mode', () => {
    const fixture = join(root, 'clip.mp4');
    writeFileSync(fixture, 'x');
    process.env[E2E_TEST_MODE_ENV] = '1';
    process.env[E2E_FIXTURE_ENV] = `  ${fixture}  `;

    expect(resolveE2eFixture()).toEqual({ active: true, fixturePath: fixture });
    expect(resolveYtdlpMediaUrl(WATCH_URL)).toBe(fixture);
  });

  it('accepts the committed sample and a file URL to that file', () => {
    const fixture = join(process.cwd(), 'tests/fixtures/e2e/sample.mp4');
    expect(statSync(fixture).size).toBeGreaterThan(0);

    process.env[E2E_TEST_MODE_ENV] = '1';
    process.env[E2E_FIXTURE_ENV] = fixture;
    expect(resolveE2eFixture()).toEqual({ active: true, fixturePath: fixture });

    process.env[E2E_FIXTURE_ENV] = pathToFileURL(fixture).href;
    expect(resolveE2eFixture()).toEqual({ active: true, fixturePath: fixture });
  });

  it('rejects a missing file, a directory, a relative path, and a remote URL', () => {
    process.env[E2E_TEST_MODE_ENV] = '1';
    process.env[E2E_FIXTURE_ENV] = join(root, 'missing.mp4');
    expect(() => resolveE2eFixture()).toThrow(E2eTestHookError);
    expect(() => resolveE2eFixture()).toThrow(/does not exist/);

    process.env[E2E_FIXTURE_ENV] = root;
    expect(() => resolveE2eFixture()).toThrow(/must be a file/);

    process.env[E2E_FIXTURE_ENV] = 'tests/fixtures/e2e/sample.mp4';
    expect(() => resolveE2eFixture()).toThrow(/absolute local path/);

    process.env[E2E_FIXTURE_ENV] = 'https://example.com/clip.mp4';
    expect(() => resolveE2eFixture()).toThrow(/local path or file URL/);

    process.env[E2E_FIXTURE_ENV] = 'file://%';
    expect(() => resolveYtdlpMediaUrl(WATCH_URL)).toThrow(
      /file URL is invalid/,
    );

    process.env[E2E_FIXTURE_ENV] = 'file:///nope%';
    expect(() => resolveE2eFixture()).toThrow(/file URL is invalid/);
  });

  it('ignores a non-string fixture value', () => {
    const env = {
      [E2E_TEST_MODE_ENV]: '1',
      [E2E_FIXTURE_ENV]: 1,
    } as unknown as NodeJS.ProcessEnv;
    expect(resolveYtdlpMediaUrl(WATCH_URL, env)).toBe(WATCH_URL);
  });

  it('accepts a Windows path and a UNC path without calling the host stat first', () => {
    process.env[E2E_TEST_MODE_ENV] = '1';
    const windowsPath = 'C:\\fixtures\\sample.mp4';
    process.env[E2E_FIXTURE_ENV] = windowsPath;
    expect(resolveE2eFixture(process.env, fsKind('file'))).toEqual({
      active: true,
      fixturePath: windowsPath,
    });

    const uncPath = '\\\\server\\share\\sample.mp4';
    process.env[E2E_FIXTURE_ENV] = uncPath;
    expect(resolveYtdlpMediaUrl(WATCH_URL, process.env, fsKind('file'))).toBe(
      uncPath,
    );
  });

  it('does not stat a remote URL', () => {
    process.env[E2E_TEST_MODE_ENV] = '1';
    process.env[E2E_FIXTURE_ENV] = 'http://example.com/clip.mp4';
    const fs = {
      stat: () => {
        throw new Error('stat should not run');
      },
    };
    expect(() => resolveE2eFixture(process.env, fs)).toThrow(
      /local path or file URL/,
    );
  });

  it('resolves an output directory only in test mode and rejects a file', () => {
    const out = join(root, 'out');
    mkdirSync(out);
    process.env[E2E_OUTPUT_DIR_ENV] = out;
    expect(resolveE2eOutputDir()).toBeUndefined();

    process.env[E2E_TEST_MODE_ENV] = '1';
    expect(resolveE2eOutputDir()).toBe(out);

    process.env[E2E_OUTPUT_DIR_ENV] = join(root, 'missing');
    expect(() => resolveE2eOutputDir()).toThrow(/does not exist/);

    const fixture = join(root, 'clip.mp4');
    writeFileSync(fixture, 'x');
    process.env[E2E_OUTPUT_DIR_ENV] = fixture;
    expect(() => resolveE2eOutputDir()).toThrow(/must be a directory/);

    process.env[E2E_OUTPUT_DIR_ENV] = pathToFileURL(out).href;
    expect(resolveE2eOutputDir()).toBe(out);
  });
});
