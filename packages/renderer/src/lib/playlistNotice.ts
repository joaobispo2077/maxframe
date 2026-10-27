export const PLAYLIST_NOTICE =
  'Playlist link. Only this video will be downloaded.';

export function isPlaylistLink(url: string | undefined): boolean {
  return typeof url === 'string' && url.toLowerCase().includes('list=');
}
