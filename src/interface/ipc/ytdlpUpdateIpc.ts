import type { YtdlpUpdateView } from '../../domain/ytdlp/ytdlpUpdateView.js';
import type { YtdlpUpdateController } from '../../infrastructure/youtube/ytdlpUpdateController.js';

import {
  YTDLP_UPDATE_CHECK_CHANNEL,
  YTDLP_UPDATE_DISMISS_CHANNEL,
  YTDLP_UPDATE_START_CHANNEL,
  YTDLP_UPDATE_STATUS_CHANNEL,
} from './ytdlpUpdateChannels.js';

type IpcHandle = {
  handle: (
    channel: string,
    listener: () => YtdlpUpdateView | Promise<YtdlpUpdateView>,
  ) => void;
};

/**
 * The renderer can ask for status, dismiss, check, or start.
 * It cannot pass a URL, path, or version. Extra invoke arguments are ignored.
 */
export function registerYtdlpUpdateHandlers(
  ipc: IpcHandle,
  controller: YtdlpUpdateController,
): void {
  ipc.handle(YTDLP_UPDATE_STATUS_CHANNEL, () => controller.getView());
  ipc.handle(YTDLP_UPDATE_DISMISS_CHANNEL, () => controller.dismiss());
  ipc.handle(YTDLP_UPDATE_START_CHANNEL, () => controller.startUpdate());
  ipc.handle(YTDLP_UPDATE_CHECK_CHANNEL, () => controller.checkNow());
}
