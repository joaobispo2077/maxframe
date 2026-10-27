import {
  YtdlpUpdateFailure,
  asYtdlpNetworkFailure,
} from '../../domain/ytdlp/YtdlpUpdateFailure.js';

const MAX_REDIRECTS = 5;
const MAX_BYTES = 80 * 1024 * 1024;

export type OfficialFetch = (
  url: string,
  init: {
    redirect: 'manual';
    signal: AbortSignal;
    headers: Record<string, string>;
  },
) => Promise<{
  status: number;
  headers: { get(name: string): string | null };
  arrayBuffer: () => Promise<ArrayBuffer>;
}>;

export async function fetchOfficialHttps(options: {
  url: string;
  expectUrl: string;
  timeoutMs: number;
  fetchImpl?: OfficialFetch;
}): Promise<Buffer> {
  const fetchImpl = options.fetchImpl ?? (globalThis.fetch as OfficialFetch);
  const signal = AbortSignal.timeout(options.timeoutMs);
  try {
    return await followHttps(options.url, options.expectUrl, fetchImpl, signal);
  } catch (error) {
    throw asYtdlpNetworkFailure(error);
  }
}

async function followHttps(
  startUrl: string,
  expectUrl: string,
  fetchImpl: OfficialFetch,
  signal: AbortSignal,
): Promise<Buffer> {
  let url = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    assertHopUrl(url, expectUrl, hop);
    const response = await fetchImpl(url, {
      redirect: 'manual',
      signal,
      headers: {
        'User-Agent': 'maxframe',
        Accept: 'application/vnd.github+json',
      },
    });
    const kind = responseKind(response.status);
    if (kind === 'redirect') {
      url = httpsRedirectUrl(response.headers.get('location'), url);
      continue;
    }
    if (kind === 'error') {
      throw new YtdlpUpdateFailure('network', `HTTP ${response.status}`);
    }
    return await readBody(response);
  }
  throw new YtdlpUpdateFailure('network', 'too many redirects');
}

function assertHopUrl(url: string, expectUrl: string, hop: number): void {
  if (hop === 0 && url !== expectUrl) {
    throw new YtdlpUpdateFailure('checksum', 'refusing a non-official URL');
  }
  assertHttps(url);
}

function responseKind(status: number): 'redirect' | 'ok' | 'error' {
  if (status >= 300 && status < 400) {
    return 'redirect';
  }
  if (status >= 200 && status < 300) {
    return 'ok';
  }
  return 'error';
}

function httpsRedirectUrl(location: string | null, current: string): string {
  if (!location) {
    throw new YtdlpUpdateFailure('checksum', 'redirect missing location');
  }
  const next = new URL(location, current);
  assertHttps(next.href);
  if (next.username || next.password) {
    throw new YtdlpUpdateFailure('checksum', 'redirect had credentials');
  }
  return next.href;
}

function assertHttps(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new YtdlpUpdateFailure('checksum', 'URL is not valid');
  }
  if (parsed.protocol !== 'https:') {
    throw new YtdlpUpdateFailure('checksum', 'redirect was not https');
  }
}

async function readBody(response: {
  arrayBuffer: () => Promise<ArrayBuffer>;
}): Promise<Buffer> {
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0) {
    throw new YtdlpUpdateFailure('network', 'empty download');
  }
  if (bytes.length > MAX_BYTES) {
    throw new YtdlpUpdateFailure('network', 'download too large');
  }
  return bytes;
}
