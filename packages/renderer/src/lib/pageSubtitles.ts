import type { AppTab } from '../hooks/useAppNavigation.js';

export const PAGE_SUBTITLES: Record<AppTab, string> = {
  analyze: 'Paste a link, pick a quality, download.',
  queue: 'Download multiple videos you added from Analyze.',
  settings: 'Output defaults and troubleshooting tools.',
};

export const ANALYZE_URLS_HELPER =
  'One link per line. Check quality looks at the first link. Add to queue sends all of them to the Queue.';
