export type YtdlpCopySource = 'env' | 'updated' | 'bundled' | 'path';

export type YtdlpUpdatePhase =
  | 'idle'
  | 'outdated'
  | 'updating'
  | 'success'
  | 'error-network'
  | 'error-checksum'
  | 'error-write'
  | 'fallback'
  | 'up-to-date'
  | 'check-failed';

/** Status the renderer may see. No filesystem path, URL, or command. */
export type YtdlpUpdateView = {
  version: string | undefined;
  source: YtdlpCopySource;
  phase: YtdlpUpdatePhase;
  current: string | undefined;
  latest: string | undefined;
  bundled: string | undefined;
  manualCheckEnabled: boolean;
  showLaunchDisclosure: boolean;
  updateAllowed: boolean;
};
