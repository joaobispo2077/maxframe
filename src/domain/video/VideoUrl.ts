const YOUTUBE_URL_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
]);

export class InvalidVideoUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidVideoUrlError';
  }
}

export function createVideoUrl(value: string): URL {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(value);
  } catch {
    throw new InvalidVideoUrlError('Invalid URL format.');
  }

  if (!YOUTUBE_URL_HOSTS.has(parsedUrl.hostname)) {
    throw new InvalidVideoUrlError('Only YouTube URLs are supported.');
  }

  return parsedUrl;
}

