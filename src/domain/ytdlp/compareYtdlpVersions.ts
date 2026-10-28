import { YTDLP_OUTDATED_GRACE_DAYS } from './ytdlpUpdatePolicy.js';

export type YtdlpVersionParts = {
  year: number;
  month: number;
  day: number;
  patch: number;
};

const VERSION_PATTERN = /^(\d{4})\.(\d{1,2})\.(\d{1,2})(?:\.(\d+))?$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function parseYtdlpVersion(raw: string): YtdlpVersionParts | undefined {
  const match = VERSION_PATTERN.exec(raw.trim());
  if (!match?.[1] || !match[2] || !match[3]) {
    return undefined;
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    patch: match[4] === undefined ? 0 : Number(match[4]),
  };
}

export function compareYtdlpVersions(
  left: string,
  right: string,
): -1 | 0 | 1 | undefined {
  const earlier = parseYtdlpVersion(left);
  const later = parseYtdlpVersion(right);
  if (!earlier || !later) {
    return undefined;
  }
  return compareParts(earlier, later);
}

function compareParts(
  earlier: YtdlpVersionParts,
  later: YtdlpVersionParts,
): -1 | 0 | 1 {
  const keys: (keyof YtdlpVersionParts)[] = ['year', 'month', 'day', 'patch'];
  for (const key of keys) {
    if (earlier[key] < later[key]) {
      return -1;
    }
    if (earlier[key] > later[key]) {
      return 1;
    }
  }
  return 0;
}

export function isYtdlpOutdated(input: {
  current: string;
  latest: string;
  publishedAt?: string;
  now: Date;
  graceDays?: number;
}): boolean {
  const graceDays = input.graceDays ?? YTDLP_OUTDATED_GRACE_DAYS;
  const compared = compareYtdlpVersions(input.current, input.latest);
  if (compared === undefined || compared >= 0) {
    return false;
  }
  if (graceDays <= 0) {
    return true;
  }
  return releaseIsPastGrace(input.publishedAt, input.now, graceDays);
}

function releaseIsPastGrace(
  publishedAt: string | undefined,
  now: Date,
  graceDays: number,
): boolean {
  if (!publishedAt) {
    return false;
  }
  const published = Date.parse(publishedAt);
  if (Number.isNaN(published)) {
    return false;
  }
  return now.getTime() - published >= graceDays * MS_PER_DAY;
}
