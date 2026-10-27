import { parseYtdlpVersion } from '../../domain/ytdlp/compareYtdlpVersions.js';
import { YTDLP_LATEST_RELEASE_URL } from '../../domain/ytdlp/officialYtdlpRelease.js';
import { YtdlpUpdateFailure } from '../../domain/ytdlp/YtdlpUpdateFailure.js';
import { YTDLP_CHECK_TIMEOUT_MS } from '../../domain/ytdlp/ytdlpUpdatePolicy.js';

import {
  fetchOfficialHttps,
  type OfficialFetch,
} from './fetchOfficialHttps.js';

export type LatestYtdlpRelease = {
  version: string;
  publishedAt: string;
};

export async function fetchLatestYtdlpRelease(
  options: {
    timeoutMs?: number;
    fetchImpl?: OfficialFetch;
  } = {},
): Promise<LatestYtdlpRelease> {
  const timeoutMs = options.timeoutMs ?? YTDLP_CHECK_TIMEOUT_MS;
  const bytes = await fetchOfficialHttps({
    url: YTDLP_LATEST_RELEASE_URL,
    expectUrl: YTDLP_LATEST_RELEASE_URL,
    timeoutMs,
    fetchImpl: options.fetchImpl,
  });
  return parseLatestRelease(bytes.toString('utf8'));
}

export function parseLatestRelease(text: string): LatestYtdlpRelease {
  const value = parseObject(text);
  if (!value) {
    throw new YtdlpUpdateFailure('network', 'unparsable release');
  }
  if (value.draft === true || value.prerelease === true) {
    throw new YtdlpUpdateFailure('network', 'unparsable release');
  }
  if (
    typeof value.tag_name !== 'string' ||
    typeof value.published_at !== 'string'
  ) {
    throw new YtdlpUpdateFailure('network', 'unparsable release');
  }
  if (!parseYtdlpVersion(value.tag_name)) {
    throw new YtdlpUpdateFailure('network', 'unparsable release');
  }
  return { version: value.tag_name, publishedAt: value.published_at };
}

function parseObject(text: string): Record<string, unknown> | undefined {
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
