import type { YtdlpCopySource } from '../../domain/ytdlp/ytdlpUpdateView.js';

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { readBundledYtdlpVersion } from './readBundledYtdlpVersion.js';
import { selectUpdatedYtdlp } from './selectUpdatedYtdlp.js';
import { readYtdlpUserDataDir } from './ytdlpUserDataDir.js';

type ProcessWithResources = NodeJS.Process & {
  resourcesPath?: string;
};

export type YtdlpResolution = {
  executable: string;
  source: YtdlpCopySource;
  version?: string;
  fallbackBundledVersion?: string;
};

export type ResolveYtdlpOverrides = {
  env?: NodeJS.ProcessEnv;
  platform?: string;
  resourcesPath?: string;
  userDataDir?: string;
  exists?: (path: string) => boolean;
  readText?: (path: string) => string;
  readFile?: (path: string) => Buffer;
  bundledVersion?: string;
};

/**
 * Resolves yt-dlp: `YT_DLP_PATH`, updated copy in user data, bundled `resources/yt-dlp/`, then `PATH`.
 */
export function resolveYtdlpExecutable(): string {
  return resolveYtdlp().executable;
}

export function resolveYtdlp(
  overrides: ResolveYtdlpOverrides = {},
): YtdlpResolution {
  const fromEnv = envExecutable(overrides);
  if (fromEnv) {
    return fromEnv;
  }
  return resolveWithoutEnv(overrides);
}

function envExecutable(
  overrides: ResolveYtdlpOverrides,
): YtdlpResolution | undefined {
  const env = overrides.env ?? process.env;
  const fromEnv = env.YT_DLP_PATH?.trim();
  if (!fromEnv) {
    return undefined;
  }
  return { executable: fromEnv, source: 'env' };
}

function resolveWithoutEnv(overrides: ResolveYtdlpOverrides): YtdlpResolution {
  const platform = overrides.platform ?? process.platform;
  const exists = overrides.exists ?? existsSync;
  const userDataDir =
    'userDataDir' in overrides ? overrides.userDataDir : readYtdlpUserDataDir();
  const bundled = findBundledExecutable(overrides, exists);
  const bundledVersion = bundledVersionOf(bundled, overrides);
  const updated = selectUpdatedYtdlp({
    userDataDir,
    platform,
    exists,
    readText: overrides.readText ?? ((path) => readFileSync(path, 'utf8')),
    readFile: overrides.readFile ?? readFileSync,
    bundledVersion,
    bundledPresent: Boolean(bundled),
  });
  return resolutionForDecision(updated, bundled, bundledVersion);
}

function resolutionForDecision(
  updated: ReturnType<typeof selectUpdatedYtdlp>,
  bundled: string | undefined,
  bundledVersion: string | undefined,
): YtdlpResolution {
  if (updated.kind === 'use') {
    return {
      executable: updated.path,
      source: 'updated',
      version: updated.version,
    };
  }
  if (updated.kind === 'mismatch') {
    return fallbackResolution(bundled, bundledVersion, updated.bundledVersion);
  }
  if (bundled) {
    return {
      executable: bundled,
      source: 'bundled',
      version: bundledVersion,
    };
  }
  return { executable: 'yt-dlp', source: 'path' };
}

function fallbackResolution(
  bundled: string | undefined,
  bundledVersion: string | undefined,
  fallbackBundledVersion: string,
): YtdlpResolution {
  if (bundled) {
    return {
      executable: bundled,
      source: 'bundled',
      version: bundledVersion,
      fallbackBundledVersion,
    };
  }
  return {
    executable: 'yt-dlp',
    source: 'path',
    fallbackBundledVersion,
  };
}

function bundledVersionOf(
  bundled: string | undefined,
  overrides: ResolveYtdlpOverrides,
): string | undefined {
  if (!bundled) {
    return undefined;
  }
  if ('bundledVersion' in overrides) {
    return overrides.bundledVersion;
  }
  return readBundledYtdlpVersion(bundled);
}

function findBundledExecutable(
  overrides: ResolveYtdlpOverrides,
  exists: (path: string) => boolean,
): string | undefined {
  const root =
    'resourcesPath' in overrides ? overrides.resourcesPath : resourcesPath();
  if (!root) {
    return undefined;
  }
  const platform = overrides.platform ?? process.platform;
  const bundledName = platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
  const candidates = [
    join(root, 'yt-dlp', bundledName),
    join(root, bundledName),
    join(root, 'bin', bundledName),
  ];
  for (const candidate of candidates) {
    if (exists(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

function resourcesPath(): string | undefined {
  const resources = (process as ProcessWithResources).resourcesPath;
  return typeof resources === 'string' && resources.length > 0
    ? resources
    : undefined;
}
