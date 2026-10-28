import {
  compareYtdlpVersions,
  isYtdlpOutdated,
  parseYtdlpVersion,
} from '@src/domain/ytdlp/compareYtdlpVersions.js';
import { YTDLP_OUTDATED_GRACE_DAYS } from '@src/domain/ytdlp/ytdlpUpdatePolicy.js';
import { describe, expect, it } from 'vitest';

const DAY = 24 * 60 * 60 * 1000;

describe('compareYtdlpVersions', () => {
  it('treats equal calendar versions and a missing patch as the same', () => {
    expect(compareYtdlpVersions('2026.08.19', '2026.08.19')).toBe(0);
    expect(compareYtdlpVersions('2026.08.19', '2026.08.19.0')).toBe(0);
    expect(compareYtdlpVersions('  2026.08.19  ', '2026.08.19')).toBe(0);
  });

  it('compares year, month, day, and the .N suffix as numbers', () => {
    expect(compareYtdlpVersions('2025.12.31', '2026.01.01')).toBe(-1);
    expect(compareYtdlpVersions('2026.08.19', '2026.09.01')).toBe(-1);
    expect(compareYtdlpVersions('2026.9.1', '2026.10.1')).toBe(-1);
    expect(compareYtdlpVersions('2026.08.18', '2026.08.19')).toBe(-1);
    expect(compareYtdlpVersions('2026.08.19', '2026.08.19.1')).toBe(-1);
    expect(compareYtdlpVersions('2026.08.19.1', '2026.08.19.2')).toBe(-1);
    expect(compareYtdlpVersions('2026.08.19.2', '2026.08.19.1')).toBe(1);
    expect(compareYtdlpVersions('2026.10.1', '2026.9.1')).toBe(1);
  });

  it('returns undefined when either side is not YYYY.MM.DD', () => {
    expect(parseYtdlpVersion('latest')).toBeUndefined();
    expect(compareYtdlpVersions('latest', '2026.08.19')).toBeUndefined();
    expect(
      compareYtdlpVersions('2026.08.19', '2026.08.19 extra'),
    ).toBeUndefined();
    expect(compareYtdlpVersions('', '')).toBeUndefined();
  });
});

describe('isYtdlpOutdated', () => {
  const now = new Date('2026-08-26T00:00:00.000Z');

  it('uses a grace of 0 days unless a caller passes another value', () => {
    expect(YTDLP_OUTDATED_GRACE_DAYS).toBe(0);
    expect(
      isYtdlpOutdated({
        current: '2026.03.17',
        latest: '2026.08.19',
        now,
      }),
    ).toBe(true);
    expect(
      isYtdlpOutdated({
        current: '2026.03.17',
        latest: '2026.08.19',
        publishedAt: 'not-a-date',
        now,
        graceDays: 0,
      }),
    ).toBe(true);
  });

  it('is not outdated when the copy in use is current, newer, or unparsable', () => {
    expect(
      isYtdlpOutdated({
        current: '2026.08.19',
        latest: '2026.08.19',
        now,
      }),
    ).toBe(false);
    expect(
      isYtdlpOutdated({
        current: '2026.08.19.1',
        latest: '2026.08.19',
        now,
      }),
    ).toBe(false);
    expect(
      isYtdlpOutdated({
        current: 'nope',
        latest: '2026.08.19',
        now,
      }),
    ).toBe(false);
  });

  it('waits the grace period counted from the release instant', () => {
    const published = '2026-08-19T00:00:00.000Z';
    const publishedMs = Date.parse(published);
    expect(
      isYtdlpOutdated({
        current: '2026.03.17',
        latest: '2026.08.19',
        publishedAt: published,
        now: new Date(publishedMs + 7 * DAY - 1),
        graceDays: 7,
      }),
    ).toBe(false);
    expect(
      isYtdlpOutdated({
        current: '2026.03.17',
        latest: '2026.08.19',
        publishedAt: published,
        now: new Date(publishedMs + 7 * DAY),
        graceDays: 7,
      }),
    ).toBe(true);
    expect(
      isYtdlpOutdated({
        current: '2026.03.17',
        latest: '2026.08.19',
        now,
        graceDays: 7,
      }),
    ).toBe(false);
    expect(
      isYtdlpOutdated({
        current: '2026.03.17',
        latest: '2026.08.19',
        publishedAt: 'soon',
        now,
        graceDays: 7,
      }),
    ).toBe(false);
  });
});
