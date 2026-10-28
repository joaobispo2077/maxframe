import { createYtdlpUpdateController } from '@src/infrastructure/youtube/ytdlpUpdateController.js';
import { YTDLP_UPDATE_START_CHANNEL } from '@src/interface/ipc/ytdlpUpdateChannels.js';
import { registerYtdlpUpdateHandlers } from '@src/interface/ipc/ytdlpUpdateIpc.js';
import { describe, expect, it, vi } from 'vitest';

describe('registerYtdlpUpdateHandlers', () => {
  it('starts the update without forwarding a URL, path, or version', async () => {
    const install = vi.fn(async () => {});
    const controller = createYtdlpUpdateController({
      resolve: () => ({
        executable: '/bundled/yt-dlp',
        source: 'bundled',
        version: '2026.03.17',
      }),
      fetchLatest: vi.fn(async () => ({
        version: '2026.08.19',
        publishedAt: '2026-08-19T00:00:00.000Z',
      })),
      install,
      probe: vi.fn(async () => '2026.03.17'),
      log: vi.fn(),
      isBusy: () => false,
      env: {},
      now: () => new Date('2026-08-20T00:00:00.000Z'),
    });
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    registerYtdlpUpdateHandlers(
      {
        handle(channel, listener) {
          handlers.set(channel, listener);
        },
      },
      controller,
    );

    await handlers.get(YTDLP_UPDATE_START_CHANNEL)?.(
      { sender: 'renderer' },
      'https://evil.example/yt-dlp.exe',
      'C:\\Users\\João\\yt-dlp.exe',
      '1999.01.01',
    );

    expect(install).toHaveBeenCalledTimes(1);
    expect(install).toHaveBeenCalledWith('2026.08.19');
    expect(install.mock.calls[0]).toHaveLength(1);
  });
});
