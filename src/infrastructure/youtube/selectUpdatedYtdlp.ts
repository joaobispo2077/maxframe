import { createHash } from 'node:crypto';
import { join } from 'node:path';

import { compareYtdlpVersions } from '../../domain/ytdlp/compareYtdlpVersions.js';
import { ytdlpInstalledFileName } from '../../domain/ytdlp/officialYtdlpRelease.js';
import { sha256Equals } from '../../domain/ytdlp/sha256SumsLine.js';
import { parseYtdlpInstallRecord } from '../../domain/ytdlp/ytdlpInstallRecord.js';

export type UpdatedCopyDecision =
  | { kind: 'absent' }
  | { kind: 'use'; path: string; version: string }
  | { kind: 'mismatch'; bundledVersion: string }
  | { kind: 'older' };

function updatedYtdlpBinaryPath(userDataDir: string, platform: string): string {
  return join(userDataDir, 'yt-dlp', ytdlpInstalledFileName(platform));
}

function updatedYtdlpRecordPath(userDataDir: string): string {
  return join(userDataDir, 'yt-dlp', 'record.json');
}

export function selectUpdatedYtdlp(input: {
  userDataDir: string | undefined;
  platform: string;
  exists: (path: string) => boolean;
  readText: (path: string) => string;
  readFile: (path: string) => Buffer;
  bundledVersion: string | undefined;
  bundledPresent: boolean;
}): UpdatedCopyDecision {
  if (!input.userDataDir) {
    return { kind: 'absent' };
  }
  const binary = updatedYtdlpBinaryPath(input.userDataDir, input.platform);
  const recordPath = updatedYtdlpRecordPath(input.userDataDir);
  if (!input.exists(binary) || !input.exists(recordPath)) {
    return { kind: 'absent' };
  }
  const record = readRecord(input.readText, recordPath);
  if (!record) {
    return { kind: 'absent' };
  }
  const actual = hashFile(input.readFile, binary);
  if (!actual || !sha256Equals(actual, record.sha256)) {
    return {
      kind: 'mismatch',
      bundledVersion: input.bundledVersion ?? 'unknown',
    };
  }
  if (
    !preferUpdated(record.version, input.bundledVersion, input.bundledPresent)
  ) {
    return { kind: 'older' };
  }
  return { kind: 'use', path: binary, version: record.version };
}

function readRecord(
  readText: (path: string) => string,
  recordPath: string,
): ReturnType<typeof parseYtdlpInstallRecord> {
  try {
    return parseYtdlpInstallRecord(readText(recordPath));
  } catch {
    return undefined;
  }
}

function hashFile(
  readFile: (path: string) => Buffer,
  path: string,
): string | undefined {
  try {
    return createHash('sha256').update(readFile(path)).digest('hex');
  } catch {
    return undefined;
  }
}

export function preferUpdated(
  updatedVersion: string,
  bundledVersion: string | undefined,
  bundledPresent: boolean,
): boolean {
  if (!bundledPresent) {
    return true;
  }
  if (!bundledVersion) {
    return false;
  }
  return compareYtdlpVersions(bundledVersion, updatedVersion) === -1;
}
