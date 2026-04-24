/**
 * Extracts the YouTube video id from common URL shapes (watch, shorts, embed, youtu.be).
 * Returns undefined when no id can be parsed (caller may still validate URL elsewhere).
 */
export function parseYoutubeVideoId(url: URL): string | undefined {
  const { hostname, pathname, searchParams } = url;

  if (hostname === 'youtu.be') {
    const id = pathname.split('/').filter(Boolean)[0];
    return normalizeVideoId(id);
  }

  if (!isYoutubeHost(hostname)) {
    return undefined;
  }

  const v = searchParams.get('v');
  if (v) {
    return normalizeVideoId(v);
  }

  const pathParts = pathname.split('/').filter(Boolean);
  const shortsIndex = pathParts.indexOf('shorts');
  if (shortsIndex !== -1 && pathParts[shortsIndex + 1]) {
    return normalizeVideoId(pathParts[shortsIndex + 1]);
  }

  const embedIndex = pathParts.indexOf('embed');
  if (embedIndex !== -1 && pathParts[embedIndex + 1]) {
    return normalizeVideoId(pathParts[embedIndex + 1]);
  }

  const liveIndex = pathParts.indexOf('live');
  if (liveIndex !== -1 && pathParts[liveIndex + 1]) {
    return normalizeVideoId(pathParts[liveIndex + 1]);
  }

  return undefined;
}

function isYoutubeHost(hostname: string): boolean {
  return (
    hostname === 'youtube.com' ||
    hostname === 'www.youtube.com' ||
    hostname === 'm.youtube.com' ||
    hostname === 'music.youtube.com'
  );
}

function normalizeVideoId(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  if (!/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}
