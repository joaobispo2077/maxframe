import type {
  YtdlpCopySource,
  YtdlpUpdatePhase,
  YtdlpUpdateView,
} from './ytdlpUpdateView.js';

export const YTDLP_UPDATE_BUTTON = 'Update yt-dlp';
export const YTDLP_NOT_NOW_BUTTON = 'Not now';
export const YTDLP_UPDATING_BUTTON = 'Updating yt-dlp…';
export const YTDLP_TRY_AGAIN_BUTTON = 'Try again';

/** Copywriter Expert has not supplied the Settings label. */
export const YTDLP_SETTINGS_VERSION_LABEL = 'yt-dlp version';

/** Copywriter Expert has not supplied the launch-check disclosure. */
export const YTDLP_LAUNCH_DISCLOSURE =
  'Maxframe checks GitHub for a newer yt-dlp when it starts.';

/** Copywriter Expert has not supplied the Check now label. */
export const YTDLP_CHECK_NOW_BUTTON = 'Check now';

/** Copywriter Expert has not supplied the manual-check failure. */
export const YTDLP_CHECK_FAILED_MESSAGE =
  "Couldn't check for a newer yt-dlp. Check your connection and try again.";

/** Shown when the version in use cannot be read. */
export const YTDLP_CURRENT_VERSION_UNKNOWN = 'the current version';

export function ytdlpSourceLabel(source: YtdlpCopySource): string {
  if (source === 'updated') {
    return 'updated copy';
  }
  if (source === 'bundled') {
    return 'included with the app';
  }
  if (source === 'env') {
    return 'custom path';
  }
  return 'on PATH';
}

export function ytdlpOutdatedMessage(current: string, latest: string): string {
  return `yt-dlp is out of date. You have ${current}, and ${latest} is available. Old versions often stop working when YouTube changes.`;
}

export function ytdlpUpdatingLiveMessage(latest: string): string {
  return `Updating yt-dlp to ${latest}.`;
}

export function ytdlpUpdatedMessage(latest: string): string {
  return `yt-dlp updated to ${latest}.`;
}

export function ytdlpNetworkFailureMessage(current: string): string {
  return `Couldn't update yt-dlp. Check your connection and try again. You can keep downloading with ${current}.`;
}

export function ytdlpChecksumFailureMessage(current: string): string {
  return `Couldn't update yt-dlp. The downloaded file didn't pass the safety check, so it wasn't used. You can keep downloading with ${current}.`;
}

/** Copywriter Expert has not supplied the write-failure string. */
export function ytdlpWriteFailureMessage(current: string): string {
  return `Couldn't update yt-dlp. The new version couldn't be saved, so it wasn't used. You can keep downloading with ${current}.`;
}

export function ytdlpFallbackMessage(bundled: string): string {
  return `The updated yt-dlp failed a safety check, so maxframe is using the version that came with the app (${bundled}). Update yt-dlp again to fix this.`;
}

export function ytdlpUpToDateMessage(current: string): string {
  return `yt-dlp is up to date (${current}).`;
}

type NoticeView = Pick<YtdlpUpdateView, 'current' | 'latest' | 'bundled'>;

const PHASE_NOTICE: Partial<
  Record<YtdlpUpdatePhase, (view: NoticeView, current: string) => string>
> = {
  outdated: (view, current) =>
    view.latest ? ytdlpOutdatedMessage(current, view.latest) : '',
  updating: (view) =>
    view.latest ? ytdlpUpdatingLiveMessage(view.latest) : '',
  success: (view) => (view.latest ? ytdlpUpdatedMessage(view.latest) : ''),
  'error-network': (_view, current) => ytdlpNetworkFailureMessage(current),
  'error-checksum': (_view, current) => ytdlpChecksumFailureMessage(current),
  'error-write': (_view, current) => ytdlpWriteFailureMessage(current),
  fallback: (view) =>
    ytdlpFallbackMessage(view.bundled ?? YTDLP_CURRENT_VERSION_UNKNOWN),
  'up-to-date': (_view, current) => ytdlpUpToDateMessage(current),
  'check-failed': () => YTDLP_CHECK_FAILED_MESSAGE,
};

export function ytdlpNoticeMessage(
  view: Pick<YtdlpUpdateView, 'phase' | 'current' | 'latest' | 'bundled'>,
): string | undefined {
  const current = view.current ?? YTDLP_CURRENT_VERSION_UNKNOWN;
  const message = PHASE_NOTICE[view.phase]?.(view, current);
  return message ? message : undefined;
}
