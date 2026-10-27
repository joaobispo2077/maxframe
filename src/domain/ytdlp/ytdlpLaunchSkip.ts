import type { YtdlpCopySource } from './ytdlpUpdateView.js';

export type YtdlpLaunchSkip = 'env' | 'path' | 'e2e' | 'ci-smoke';

/** No network call in these cases. Each value must match exactly. */
export function ytdlpLaunchSkipReason(input: {
  ytdlpPathEnv: string | undefined;
  source: YtdlpCopySource;
  e2e: string | undefined;
  ciSmoke: string | undefined;
}): YtdlpLaunchSkip | undefined {
  if (input.e2e === '1') {
    return 'e2e';
  }
  if (input.ciSmoke === '1') {
    return 'ci-smoke';
  }
  if (input.ytdlpPathEnv?.trim()) {
    return 'env';
  }
  if (input.source === 'path') {
    return 'path';
  }
  return undefined;
}
