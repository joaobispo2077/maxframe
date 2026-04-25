import type { AppModule } from '../AppModule.js';
import type { ModuleContext } from '../ModuleContext.js';

import { ipcMain } from 'electron';
import { analyzeVideoHandler } from '../../../../src/interface/ipc/analyzeVideoHandler.js';
import {
  type DownloadVideoRequest,
  downloadVideoHandler,
  type DownloadVideoSink,
} from '../downloadVideoHandler.js';

const CHANNEL_GET_INITIAL_STATE = 'app:get-initial-state';
const CHANNEL_PING = 'app:ping';
const CHANNEL_ANALYZE_VIDEO_URL = 'app:analyze-video-url';
const CHANNEL_DOWNLOAD_VIDEO = 'app:download-video';
const CHANNEL_DOWNLOAD_VIDEO_PROGRESS = 'app:download-video-progress';
const CHANNEL_DOWNLOAD_VIDEO_CANCEL = 'app:download-video-cancel';

let activeDownloadAbort: AbortController | undefined;

class IpcBridge implements AppModule {
  enable(_context: ModuleContext): void {
    ipcMain.handle(CHANNEL_GET_INITIAL_STATE, () => ({
      appName: 'Maxframe',
      status: 'ready',
    }));

    ipcMain.handle(CHANNEL_PING, (_event, payload: string) => payload);
    ipcMain.handle(CHANNEL_ANALYZE_VIDEO_URL, (_event, url: string) =>
      analyzeVideoHandler(url),
    );

    ipcMain.handle(
      CHANNEL_DOWNLOAD_VIDEO,
      async (event, payload: DownloadVideoRequest) => {
        if (activeDownloadAbort) {
          throw new Error('A download is already in progress.');
        }
        const controller = new AbortController();
        activeDownloadAbort = controller;
        const sink: DownloadVideoSink = {
          signal: controller.signal,
          onProgressLine: (line) => {
            if (!event.sender.isDestroyed()) {
              event.sender.send(CHANNEL_DOWNLOAD_VIDEO_PROGRESS, { line });
            }
          },
        };
        try {
          return await downloadVideoHandler(payload, sink);
        } finally {
          activeDownloadAbort = undefined;
        }
      },
    );

    ipcMain.handle(CHANNEL_DOWNLOAD_VIDEO_CANCEL, () => {
      if (!activeDownloadAbort) {
        return { canceled: false };
      }
      activeDownloadAbort.abort();
      return { canceled: true };
    });
  }
}

export function createIpcBridgeModule() {
  return new IpcBridge();
}
