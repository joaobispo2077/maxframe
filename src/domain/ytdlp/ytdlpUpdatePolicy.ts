/**
 * Pending product decisions for the yt-dlp update (issue #69).
 * João has not settled these. Change them here only.
 *
 * 1. YTDLP_OUTDATED_GRACE_DAYS — when a newer stable release counts as outdated.
 * 2. YTDLP_NOT_NOW_SNOOZE — what Not now does after this launch.
 * 3. YTDLP_SETTINGS_CHECK_NOW — whether Settings has a Check now button.
 * 4. YTDLP_LAUNCH_CHECK_DISCLOSURE — how the launch-time GitHub call is disclosed.
 * 5. YTDLP_CHECK_TIMEOUT_MS — how long the launch check and each download wait.
 */

/** Days after the latest stable release before the copy in use counts as outdated. 0 means any newer stable release. */
export const YTDLP_OUTDATED_GRACE_DAYS = 0;

/**
 * How long Not now hides the outdated warning.
 * - session: the rest of this launch. The warning comes back on the next launch.
 * - until-newer: it stays hidden until a release newer than the dismissed one is published.
 */
export const YTDLP_NOT_NOW_SNOOZE = 'session' as 'session' | 'until-newer';

export type YtdlpNotNowSnooze = typeof YTDLP_NOT_NOW_SNOOZE;

/** Settings shows a Check now button when this is true. */
export const YTDLP_SETTINGS_CHECK_NOW = false;

/**
 * Where the automatic GitHub call on launch is disclosed.
 * - settings-line: a sentence under the yt-dlp version in Settings.
 * - readme: no in-app sentence.
 */
export const YTDLP_LAUNCH_CHECK_DISCLOSURE = 'settings-line' as
  | 'settings-line'
  | 'readme';

export type YtdlpLaunchCheckDisclosure = typeof YTDLP_LAUNCH_CHECK_DISCLOSURE;

/** Milliseconds before the launch check and each update download give up. */
export const YTDLP_CHECK_TIMEOUT_MS = 10_000;
