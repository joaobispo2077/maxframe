import { compareYtdlpVersions } from './compareYtdlpVersions.js';
import {
  YTDLP_NOT_NOW_SNOOZE,
  type YtdlpNotNowSnooze,
} from './ytdlpUpdatePolicy.js';

export function isOutdatedNoticeHidden(input: {
  snooze?: YtdlpNotNowSnooze;
  dismissedThisSession: boolean;
  dismissedLatest: string | undefined;
  latest: string;
}): boolean {
  if (input.dismissedThisSession) {
    return true;
  }
  const snooze = input.snooze ?? YTDLP_NOT_NOW_SNOOZE;
  if (snooze !== 'until-newer') {
    return false;
  }
  return dismissedCoversLatest(input.dismissedLatest, input.latest);
}

function dismissedCoversLatest(
  dismissed: string | undefined,
  latest: string,
): boolean {
  if (!dismissed) {
    return false;
  }
  const compared = compareYtdlpVersions(dismissed, latest);
  if (compared === undefined) {
    return false;
  }
  return compared >= 0;
}
