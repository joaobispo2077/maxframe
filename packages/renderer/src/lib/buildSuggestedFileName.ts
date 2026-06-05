import type { OutputMode } from './appPreferences.js';

export function buildSuggestedFileName(input: {
  title?: string;
  videoId?: string;
  uploader?: string;
  outputMode: OutputMode;
}): string {
  const clean = (s: string) =>
    s
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  const safeTitle = clean(input.title || input.videoId || 'video');
  const safeUploader = clean(input.uploader ?? '') || 'Unknown Channel';
  const stem = `${safeTitle} - ${safeUploader}`.slice(0, 200).trimEnd();
  return `${stem}.${input.outputMode}`;
}
