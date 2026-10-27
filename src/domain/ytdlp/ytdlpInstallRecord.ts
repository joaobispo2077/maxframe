import { parseYtdlpVersion } from './compareYtdlpVersions.js';

export type YtdlpInstallRecord = {
  version: string;
  sha256: string;
};

const SHA256_HEX = /^[0-9a-fA-F]{64}$/;

export function parseYtdlpInstallRecord(
  text: string,
): YtdlpInstallRecord | undefined {
  const value = parseJson(text);
  if (!value) {
    return undefined;
  }
  const version = value.version;
  const sha256 = value.sha256;
  if (typeof version !== 'string' || typeof sha256 !== 'string') {
    return undefined;
  }
  if (!parseYtdlpVersion(version) || !SHA256_HEX.test(sha256)) {
    return undefined;
  }
  return { version, sha256: sha256.toLowerCase() };
}

function parseJson(text: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value !== 'object' || value === null) {
      return undefined;
    }
    return value as Record<string, unknown>;
  } catch {
    return undefined;
  }
}
