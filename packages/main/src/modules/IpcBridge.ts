import type { AppModule } from '../AppModule.js';
import type { ModuleContext } from '../ModuleContext.js';

import { join } from 'node:path';

import { ipcMain, shell } from 'electron';
import { app } from 'electron';

import { writeLogEntry } from '../../../../src/infrastructure/diagnostics/debugLogger.js';
import { analyzeVideoHandler } from '../../../../src/interface/ipc/analyzeVideoHandler.js';
import { setDebugMode } from '../../../../src/interface/ipc/debugModeStore.js';
import {
  clearError,
  recordError,
} from '../../../../src/interface/ipc/errorStore.js';
import { getDiagnosticsHandler } from '../../../../src/interface/ipc/getDiagnosticsHandler.js';
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
const CHANNEL_SET_DEBUG_MODE = 'app:set-debug-mode';
const CHANNEL_GET_DIAGNOSTICS = 'app:get-diagnostics';

let activeDownloadAbort: AbortController | undefined;

class IpcBridge implements AppModule {
  readonly #isPortable: boolean;

  constructor({ isPortable = false }: { isPortable?: boolean } = {}) {
    this.#isPortable = isPortable;
  }

  enable(_context: ModuleContext): void {
    ipcMain.handle(CHANNEL_GET_INITIAL_STATE, () => ({
      appName: 'Maxframe',
      status: 'ready',
      isPortable: this.#isPortable,
    }));

    ipcMain.handle(CHANNEL_PING, (_event, payload: string) => payload);

    ipcMain.handle(CHANNEL_ANALYZE_VIDEO_URL, async (_event, url: string) => {
      clearError();
      try {
        return await analyzeVideoHandler(url);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        recordError(msg);
        writeLogEntry({ event: 'analyze-error', error: msg });
        throw error;
      }
    });

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
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          if (msg !== 'Download canceled.') {
            recordError(msg);
            writeLogEntry({ event: 'download-error', error: msg });
          }
          throw error;
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

    ipcMain.handle(
      CHANNEL_SET_DEBUG_MODE,
      (_event, payload: { on: boolean }) => {
        setDebugMode(payload.on);
      },
    );

    ipcMain.handle(CHANNEL_GET_DIAGNOSTICS, () => getDiagnosticsHandler());

    ipcMain.handle('app:get-log-path', () =>
      join(app.getPath('userData'), 'maxframe-debug.log'),
    );

    ipcMain.handle('app:show-item-in-folder', (_event, filePath: string) => {
      shell.showItemInFolder(filePath);
    });
  }
}

export function createIpcBridgeModule(opts?: { isPortable?: boolean }) {
  return new IpcBridge(opts);
}
