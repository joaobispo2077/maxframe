/** AAC-preferring audio merge suffix for video-only `-f` selectors. */
export const SOCIAL_COMPATIBLE_AUDIO_MERGE_SELECTOR =
  'ba[acodec^=mp4a]/bestaudio[acodec^=mp4a]/bestaudio';

/** yt-dlp format sort for H.264 + AAC preference. */
export const SOCIAL_COMPATIBLE_FORMAT_SORT = 'vcodec:h264,acodec:aac';

/** Post-processor args for VideoConvertor: copy video, encode AAC. */
export const SOCIAL_COMPATIBLE_VIDEO_CONVERTOR_PPA =
  'VideoConvertor:-c:v copy -c:a aac -b:a 128k -movflags +faststart';

/** Builds full video-only MP4 selector, e.g. `135+ba[acodec^=mp4a]/...`. */
export function buildSocialCompatibleVideoOnlySelector(
  formatId: string,
): string {
  return `${formatId}+${SOCIAL_COMPATIBLE_AUDIO_MERGE_SELECTOR}`;
}

/** yt-dlp CLI flag pairs to prepend when producing social-compatible MP4. */
export function socialCompatibleMp4YtdlpArgPairs(): readonly (readonly [
  string,
  string,
])[] {
  return [
    ['-S', SOCIAL_COMPATIBLE_FORMAT_SORT],
    ['--recode-video', 'mp4'],
    ['--ppa', SOCIAL_COMPATIBLE_VIDEO_CONVERTOR_PPA],
    ['--merge-output-format', 'mp4'],
  ];
}
