import {
  officialYtdlpAssetUrl,
  officialYtdlpSumsUrl,
  YTDLP_LATEST_RELEASE_URL,
  ytdlpInstalledFileName,
  ytdlpReleaseAssetName,
} from '@src/domain/ytdlp/officialYtdlpRelease.js';
import {
  sha256Equals,
  sha256ForAsset,
} from '@src/domain/ytdlp/sha256SumsLine.js';
import { parseYtdlpInstallRecord } from '@src/domain/ytdlp/ytdlpInstallRecord.js';
import { ytdlpLaunchSkipReason } from '@src/domain/ytdlp/ytdlpLaunchSkip.js';
import { isOutdatedNoticeHidden } from '@src/domain/ytdlp/ytdlpNotNow.js';
import {
  YTDLP_CHECK_FAILED_MESSAGE,
  YTDLP_CHECK_NOW_BUTTON,
  YTDLP_LAUNCH_DISCLOSURE,
  YTDLP_NOT_NOW_BUTTON,
  YTDLP_SETTINGS_VERSION_LABEL,
  YTDLP_TRY_AGAIN_BUTTON,
  YTDLP_UPDATE_BUTTON,
  YTDLP_UPDATING_BUTTON,
  ytdlpChecksumFailureMessage,
  ytdlpFallbackMessage,
  ytdlpNetworkFailureMessage,
  ytdlpNoticeMessage,
  ytdlpOutdatedMessage,
  ytdlpSourceLabel,
  ytdlpUpdatedMessage,
  ytdlpUpdatingLiveMessage,
  ytdlpUpToDateMessage,
  ytdlpWriteFailureMessage,
} from '@src/domain/ytdlp/ytdlpUpdateCopy.js';
import {
  asYtdlpNetworkFailure,
  YtdlpUpdateFailure,
} from '@src/domain/ytdlp/YtdlpUpdateFailure.js';
import {
  YTDLP_CHECK_TIMEOUT_MS,
  YTDLP_LAUNCH_CHECK_DISCLOSURE,
  YTDLP_NOT_NOW_SNOOZE,
  YTDLP_SETTINGS_CHECK_NOW,
} from '@src/domain/ytdlp/ytdlpUpdatePolicy.js';
import { describe, expect, it } from 'vitest';

const HASH = 'a'.repeat(64);

describe('sha256ForAsset', () => {
  it('returns the single matching line, including the asterisk form', () => {
    const text = [
      `${HASH.toUpperCase()}  yt-dlp.exe`,
      `${'b'.repeat(64)} *yt-dlp_linux`,
      '',
    ].join('\n');
    expect(sha256ForAsset(text, 'yt-dlp.exe')).toBe(HASH);
    expect(
      sha256ForAsset(`${'c'.repeat(64)} *yt-dlp.exe\r\n`, 'yt-dlp.exe'),
    ).toBe('c'.repeat(64));
    expect(sha256Equals(HASH.toUpperCase(), HASH)).toBe(true);
    expect(sha256Equals(HASH, 'b'.repeat(64))).toBe(false);
  });

  it('fails closed when the asset is missing or duplicated', () => {
    expect(sha256ForAsset('', 'yt-dlp.exe')).toBeUndefined();
    expect(
      sha256ForAsset(`${'b'.repeat(64)}  other\n`, 'yt-dlp.exe'),
    ).toBeUndefined();
    expect(sha256ForAsset('short  yt-dlp.exe\n', 'yt-dlp.exe')).toBeUndefined();
    const duplicated = `${HASH}  yt-dlp.exe\n${'b'.repeat(64)}  yt-dlp.exe\n`;
    expect(sha256ForAsset(duplicated, 'yt-dlp.exe')).toBeUndefined();
  });
});

describe('ytdlp launch skip and Not now', () => {
  it('skips only the four exact cases', () => {
    expect(
      ytdlpLaunchSkipReason({
        ytdlpPathEnv: ' C:\\tools\\yt-dlp.exe ',
        source: 'bundled',
        e2e: undefined,
        ciSmoke: undefined,
      }),
    ).toBe('env');
    expect(
      ytdlpLaunchSkipReason({
        ytdlpPathEnv: '  ',
        source: 'path',
        e2e: undefined,
        ciSmoke: undefined,
      }),
    ).toBe('path');
    expect(
      ytdlpLaunchSkipReason({
        ytdlpPathEnv: undefined,
        source: 'bundled',
        e2e: '1',
        ciSmoke: undefined,
      }),
    ).toBe('e2e');
    expect(
      ytdlpLaunchSkipReason({
        ytdlpPathEnv: undefined,
        source: 'updated',
        e2e: undefined,
        ciSmoke: '1',
      }),
    ).toBe('ci-smoke');
    expect(
      ytdlpLaunchSkipReason({
        ytdlpPathEnv: undefined,
        source: 'bundled',
        e2e: 'true',
        ciSmoke: 'yes',
      }),
    ).toBeUndefined();
  });

  it('hides Not now for this session, and until a newer release when that snooze is selected', () => {
    expect(YTDLP_NOT_NOW_SNOOZE).toBe('session');
    expect(
      isOutdatedNoticeHidden({
        dismissedThisSession: false,
        dismissedLatest: '2026.08.19',
        latest: '2026.08.19',
      }),
    ).toBe(false);
    expect(
      isOutdatedNoticeHidden({
        dismissedThisSession: true,
        dismissedLatest: undefined,
        latest: '2026.08.19',
      }),
    ).toBe(true);
    expect(
      isOutdatedNoticeHidden({
        snooze: 'until-newer',
        dismissedThisSession: false,
        dismissedLatest: '2026.08.19',
        latest: '2026.08.19',
      }),
    ).toBe(true);
    expect(
      isOutdatedNoticeHidden({
        snooze: 'until-newer',
        dismissedThisSession: false,
        dismissedLatest: '2026.08.19',
        latest: '2026.09.01',
      }),
    ).toBe(false);
    expect(
      isOutdatedNoticeHidden({
        snooze: 'until-newer',
        dismissedThisSession: false,
        dismissedLatest: undefined,
        latest: '2026.09.01',
      }),
    ).toBe(false);
    expect(
      isOutdatedNoticeHidden({
        snooze: 'until-newer',
        dismissedThisSession: false,
        dismissedLatest: 'nope',
        latest: '2026.09.01',
      }),
    ).toBe(false);
  });
});

describe('official yt-dlp URLs and copy', () => {
  it('builds only the official https release URL', () => {
    expect(officialYtdlpAssetUrl('2026.08.19', 'yt-dlp.exe')).toBe(
      'https://github.com/yt-dlp/yt-dlp/releases/download/2026.08.19/yt-dlp.exe',
    );
    expect(officialYtdlpSumsUrl('2026.08.19')).toBe(
      'https://github.com/yt-dlp/yt-dlp/releases/download/2026.08.19/SHA2-256SUMS',
    );
    expect(YTDLP_LATEST_RELEASE_URL).toBe(
      'https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest',
    );
    expect(ytdlpReleaseAssetName('win32')).toBe('yt-dlp.exe');
    expect(ytdlpReleaseAssetName('linux')).toBe('yt-dlp_linux');
    expect(ytdlpReleaseAssetName('darwin')).toBe('yt-dlp_macos');
    expect(ytdlpReleaseAssetName('freebsd')).toBe('yt-dlp');
    expect(ytdlpInstalledFileName('win32')).toBe('yt-dlp.exe');
    expect(ytdlpInstalledFileName('linux')).toBe('yt-dlp');
    expect(() => officialYtdlpAssetUrl('../2026', 'yt-dlp.exe')).toThrow(
      /stable/,
    );
    expect(() => officialYtdlpAssetUrl('2026.08.19', '../yt-dlp.exe')).toThrow(
      /not allowed/,
    );
  });

  it('uses the Copywriter Expert strings and names the missing ones', () => {
    expect(YTDLP_SETTINGS_CHECK_NOW).toBe(false);
    expect(YTDLP_LAUNCH_CHECK_DISCLOSURE).toBe('settings-line');
    expect(YTDLP_CHECK_TIMEOUT_MS).toBe(10_000);
    expect(YTDLP_UPDATE_BUTTON).toBe('Update yt-dlp');
    expect(YTDLP_NOT_NOW_BUTTON).toBe('Not now');
    expect(YTDLP_UPDATING_BUTTON).toBe('Updating yt-dlp…');
    expect(YTDLP_TRY_AGAIN_BUTTON).toBe('Try again');
    expect(YTDLP_SETTINGS_VERSION_LABEL).toBe('yt-dlp version');
    expect(YTDLP_CHECK_NOW_BUTTON).toBe('Check now');
    expect(ytdlpOutdatedMessage('2026.03.17', '2026.08.19')).toBe(
      'yt-dlp is out of date. You have 2026.03.17, and 2026.08.19 is available. Old versions often stop working when YouTube changes.',
    );
    expect(ytdlpUpdatingLiveMessage('2026.08.19')).toBe(
      'Updating yt-dlp to 2026.08.19.',
    );
    expect(ytdlpUpdatedMessage('2026.08.19')).toBe(
      'yt-dlp updated to 2026.08.19.',
    );
    expect(ytdlpNetworkFailureMessage('2026.03.17')).toBe(
      "Couldn't update yt-dlp. Check your connection and try again. You can keep downloading with 2026.03.17.",
    );
    expect(ytdlpChecksumFailureMessage('2026.03.17')).toBe(
      "Couldn't update yt-dlp. The downloaded file didn't pass the safety check, so it wasn't used. You can keep downloading with 2026.03.17.",
    );
    expect(ytdlpWriteFailureMessage('2026.03.17')).toContain('2026.03.17');
    expect(ytdlpFallbackMessage('2026.03.17')).toBe(
      'The updated yt-dlp failed a safety check, so maxframe is using the version that came with the app (2026.03.17). Update yt-dlp again to fix this.',
    );
    expect(ytdlpUpToDateMessage('2026.08.19')).toBe(
      'yt-dlp is up to date (2026.08.19).',
    );
    expect(YTDLP_LAUNCH_DISCLOSURE).toContain('GitHub');
    expect(YTDLP_CHECK_FAILED_MESSAGE).toContain('connection');
    expect(ytdlpSourceLabel('updated')).toBe('updated copy');
    expect(ytdlpSourceLabel('bundled')).toBe('included with the app');
    expect(ytdlpSourceLabel('env')).toBe('custom path');
    expect(ytdlpSourceLabel('path')).toBe('on PATH');
    expect(
      ytdlpNoticeMessage({
        phase: 'outdated',
        current: '2026.03.17',
        latest: '2026.08.19',
        bundled: undefined,
      }),
    ).toContain('out of date');
    expect(
      ytdlpNoticeMessage({
        phase: 'idle',
        current: '2026.03.17',
        latest: undefined,
        bundled: undefined,
      }),
    ).toBeUndefined();
    expect(
      ytdlpNoticeMessage({
        phase: 'check-failed',
        current: undefined,
        latest: undefined,
        bundled: undefined,
      }),
    ).toBe(YTDLP_CHECK_FAILED_MESSAGE);
    expect(
      ytdlpNoticeMessage({
        phase: 'updating',
        current: '2026.03.17',
        latest: '2026.08.19',
        bundled: undefined,
      }),
    ).toBe('Updating yt-dlp to 2026.08.19.');
    expect(
      ytdlpNoticeMessage({
        phase: 'success',
        current: '2026.08.19',
        latest: '2026.08.19',
        bundled: undefined,
      }),
    ).toContain('updated to');
    expect(
      ytdlpNoticeMessage({
        phase: 'error-network',
        current: '2026.03.17',
        latest: undefined,
        bundled: undefined,
      }),
    ).toContain('connection');
    expect(
      ytdlpNoticeMessage({
        phase: 'error-checksum',
        current: '2026.03.17',
        latest: undefined,
        bundled: undefined,
      }),
    ).toContain('safety check');
    expect(
      ytdlpNoticeMessage({
        phase: 'error-write',
        current: '2026.03.17',
        latest: undefined,
        bundled: undefined,
      }),
    ).toContain("couldn't be saved");
    expect(
      ytdlpNoticeMessage({
        phase: 'fallback',
        current: undefined,
        latest: undefined,
        bundled: '2026.03.17',
      }),
    ).toContain('2026.03.17');
    expect(
      ytdlpNoticeMessage({
        phase: 'up-to-date',
        current: '2026.08.19',
        latest: '2026.08.19',
        bundled: undefined,
      }),
    ).toContain('up to date');
    expect(
      ytdlpNoticeMessage({
        phase: 'fallback',
        current: undefined,
        latest: undefined,
        bundled: undefined,
      }),
    ).toContain('the current version');
    expect(
      ytdlpNoticeMessage({
        phase: 'outdated',
        current: undefined,
        latest: undefined,
        bundled: undefined,
      }),
    ).toBeUndefined();
    expect(
      ytdlpNoticeMessage({
        phase: 'updating',
        current: '2026.03.17',
        latest: undefined,
        bundled: undefined,
      }),
    ).toBeUndefined();
    expect(
      ytdlpNoticeMessage({
        phase: 'success',
        current: '2026.08.19',
        latest: undefined,
        bundled: undefined,
      }),
    ).toBeUndefined();
  });

  it('parses an install record and wraps network failures', () => {
    expect(
      parseYtdlpInstallRecord(
        JSON.stringify({ version: '2026.08.19', sha256: HASH.toUpperCase() }),
      ),
    ).toEqual({ version: '2026.08.19', sha256: HASH });
    expect(parseYtdlpInstallRecord('nope')).toBeUndefined();
    expect(parseYtdlpInstallRecord('null')).toBeUndefined();
    expect(parseYtdlpInstallRecord('[]')).toBeUndefined();
    expect(
      parseYtdlpInstallRecord(
        JSON.stringify({ version: 'nope', sha256: HASH }),
      ),
    ).toBeUndefined();
    expect(
      parseYtdlpInstallRecord(
        JSON.stringify({ version: '2026.08.19', sha256: 'short' }),
      ),
    ).toBeUndefined();
    const failure = new YtdlpUpdateFailure('checksum', 'nope');
    expect(asYtdlpNetworkFailure(failure)).toBe(failure);
    expect(asYtdlpNetworkFailure(new Error('offline')).reason).toBe('network');
    const timeout = new Error('The operation was aborted');
    timeout.name = 'TimeoutError';
    expect(asYtdlpNetworkFailure(timeout).message).toContain('timeout');
    const abort = new Error('aborted');
    abort.name = 'AbortError';
    expect(asYtdlpNetworkFailure(abort).message).toContain('timeout');
    expect(asYtdlpNetworkFailure('dns').message).toBe('dns');
  });
});
