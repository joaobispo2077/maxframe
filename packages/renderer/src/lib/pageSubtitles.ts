import type { AppTab } from '../hooks/useAppNavigation.js';

export const PAGE_SUBTITLES: Record<AppTab, string> = {
  analyze: 'Pick a video, compare quality options, then download.',
  queue: 'Download multiple videos you added from Analyze.',
  settings: 'Output defaults and troubleshooting tools.',
};

export const ANALYZE_URLS_HELPER =
  'One URL per line. Analyze quality previews the first URL. Add to queue sends every URL to the Queue tab.';
