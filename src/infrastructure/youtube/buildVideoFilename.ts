const FORBIDDEN_CHARS = /[\\/:*?"<>|]/g;

export function buildVideoFilename(
  title: string,
  uploader: string,
  outputMode: 'mp3' | 'mp4',
): string {
  const clean = (s: string) =>
    s.replace(FORBIDDEN_CHARS, '').replace(/\s+/g, ' ').trim();
  const safeTitle = clean(title);
  const safeUploader = clean(uploader) || 'Unknown Channel';
  const stem = `${safeTitle} - ${safeUploader}`.slice(0, 200).trimEnd();
  return `${stem}.${outputMode}`;
}
