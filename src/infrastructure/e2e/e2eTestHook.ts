import { statSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Test-only media source for the packaged-app GUI check (issue 85, AC15).
 *
 * The hook is active only when `MAXFRAME_E2E` is exactly `1` and the path
 * variable names a local file or directory that exists. A fixture path on its
 * own does nothing, so a stray environment variable cannot retarget a normal
 * launch. Playwright starts the portable exe, so this has to be a runtime
 * check rather than a flag compiled out of production builds.
 */
export const E2E_TEST_MODE_ENV = 'MAXFRAME_E2E';
export const E2E_FIXTURE_ENV = 'MAXFRAME_E2E_FIXTURE';
export const E2E_OUTPUT_DIR_ENV = 'MAXFRAME_E2E_OUTPUT_DIR';

export class E2eTestHookError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'E2eTestHookError';
  }
}

type PathStat = {
  isFile: () => boolean;
  isDirectory: () => boolean;
};

export type E2eTestHookFs = {
  stat: (path: string) => PathStat;
};

export type E2eFixtureResolution =
  | { active: false }
  | { active: true; fixturePath: string };

const defaultFs: E2eTestHookFs = {
  stat: (path) => statSync(path),
};

const REMOTE_SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

function isTestMode(env: NodeJS.ProcessEnv): boolean {
  return env[E2E_TEST_MODE_ENV] === '1';
}

function readTrimmed(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const value = env[key];
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  return trimmed;
}

function isWindowsAbsolute(value: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(value) || value.startsWith('\\\\');
}

function pathFromFileUrl(raw: string, envName: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new E2eTestHookError(`${envName} file URL is invalid.`);
  }
  if (url.protocol !== 'file:') {
    throw new E2eTestHookError(`${envName} must be a local path or file URL.`);
  }
  try {
    return fileURLToPath(url);
  } catch {
    throw new E2eTestHookError(`${envName} file URL is invalid.`);
  }
}

function localPathFromEnvValue(raw: string, envName: string): string {
  if (isWindowsAbsolute(raw)) {
    return raw;
  }
  if (raw.toLowerCase().startsWith('file:')) {
    return pathFromFileUrl(raw, envName);
  }
  if (REMOTE_SCHEME.test(raw)) {
    throw new E2eTestHookError(`${envName} must be a local path or file URL.`);
  }
  if (!isAbsolute(raw)) {
    throw new E2eTestHookError(`${envName} must be an absolute local path.`);
  }
  return raw;
}

function statLocalPath(
  fs: E2eTestHookFs,
  localPath: string,
  raw: string,
  envName: string,
): PathStat {
  try {
    return fs.stat(localPath);
  } catch {
    throw new E2eTestHookError(`${envName} does not exist: ${raw}`);
  }
}

function requireLocalKind(
  env: NodeJS.ProcessEnv,
  envName: string,
  kind: 'file' | 'directory',
  fs: E2eTestHookFs,
): string | undefined {
  if (!isTestMode(env)) {
    return undefined;
  }
  const raw = readTrimmed(env, envName);
  if (!raw) {
    return undefined;
  }
  const localPath = localPathFromEnvValue(raw, envName);
  const stat = statLocalPath(fs, localPath, raw, envName);
  const matches = kind === 'file' ? stat.isFile() : stat.isDirectory();
  if (!matches) {
    throw new E2eTestHookError(`${envName} must be a ${kind}: ${raw}`);
  }
  return localPath;
}

export function resolveE2eFixture(
  env: NodeJS.ProcessEnv = process.env,
  fs: E2eTestHookFs = defaultFs,
): E2eFixtureResolution {
  const fixturePath = requireLocalKind(env, E2E_FIXTURE_ENV, 'file', fs);
  if (!fixturePath) {
    return { active: false };
  }
  return { active: true, fixturePath };
}

/** YouTube URL, or the local fixture path when the test hook is active. */
export function resolveYtdlpMediaUrl(
  originalUrl: string,
  env: NodeJS.ProcessEnv = process.env,
  fs: E2eTestHookFs = defaultFs,
): string {
  const fixture = resolveE2eFixture(env, fs);
  if (!fixture.active) {
    return originalUrl;
  }
  return fixture.fixturePath;
}

/**
 * Directory that replaces the native save dialog for analyze-tab downloads.
 * Undefined when the hook is off. A request that already has `outputDir` wins.
 */
export function resolveE2eOutputDir(
  env: NodeJS.ProcessEnv = process.env,
  fs: E2eTestHookFs = defaultFs,
): string | undefined {
  return requireLocalKind(env, E2E_OUTPUT_DIR_ENV, 'directory', fs);
}
