import type { AppModule } from '../AppModule.js';
import type { ModuleContext } from '../ModuleContext.js';

import { join } from 'node:path';

import { ipcMain, shell } from 'electron';
import { app } from 'electron';

import { AnalyzeVideoUrlError } from '../../../../src/application/errors/AnalyzeVideoErrors.js';
import { writeLogEntry } from '../../../../src/infrastructure/diagnostics/debugLogger.js';
import { beginYtdlpUse } from '../../../../src/infrastructure/youtube/ytdlpBusy.js';
import { analyzeVideoHandler } from '../../../../src/interface/ipc/analyzeVideoHandler.js';
import { setDebugMode } from '../../../../src/interface/ipc/debugModeStore.js';
import {
  clearError,
  recordError,
  recordSubmittedUrl,
} from '../../../../src/interface/ipc/errorStore.js';
import { getDiagnosticsHandler } from '../../../../src/interface/ipc/getDiagnosticsHandler.js';
import { registerYtdlpUpdateHandlers } from '../../../../src/interface/ipc/ytdlpUpdateIpc.js';
import {
  type DownloadVideoRequest,
  downloadVideoHandler,
  type DownloadVideoSink,
} from '../downloadVideoHandler.js';
import { pickOutputFolderHandler } from '../pickOutputFolderHandler.js';
import { getTitleBarInset } from '../windowChrome.js';
import { getYtdlpUpdateController } from '../ytdlpUpdateRuntime.js';

const CHANNEL_GET_INITIAL_STATE = 'app:get-initial-state';
const CHANNEL_PING = 'app:ping';
const CHANNEL_ANALYZE_VIDEO_URL = 'app:analyze-video-url';
const CHANNEL_DOWNLOAD_VIDEO = 'app:download-video';
const CHANNEL_DOWNLOAD_VIDEO_PROGRESS = 'app:download-video-progress';
const CHANNEL_DOWNLOAD_VIDEO_CANCEL = 'app:download-video-cancel';
const CHANNEL_SET_DEBUG_MODE = 'app:set-debug-mode';
const CHANNEL_GET_DIAGNOSTICS = 'app:get-diagnostics';
const CHANNEL_PICK_OUTPUT_FOLDER = 'app:pick-output-folder';

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
      titleBarInset: getTitleBarInset(),
    }));

    ipcMain.handle(CHANNEL_PING, (_event, payload: string) => payload);

    ipcMain.handle(CHANNEL_ANALYZE_VIDEO_URL, async (_event, url: string) => {
      const releaseYtdlp = beginYtdlpUse();
      clearError();
      recordSubmittedUrl(url);
      try {
        return await analyzeVideoHandler(url);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        const detail =
          error instanceof AnalyzeVideoUrlError
            ? error.technicalDetail
            : undefined;
        recordError(msg, detail);
        writeLogEntry({
          event: 'analyze-error',
          error: msg,
          submittedUrl: url,
          ...(detail ? { errorDetail: detail } : {}),
        });
        throw error;
      } finally {
        releaseYtdlp();
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
        const releaseYtdlp = beginYtdlpUse();
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
          releaseYtdlp();
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

    ipcMain.handle(CHANNEL_PICK_OUTPUT_FOLDER, () => pickOutputFolderHandler());

    ipcMain.handle('app:get-log-path', () =>
      join(app.getPath('userData'), 'maxframe-debug.log'),
    );

    ipcMain.handle('app:show-item-in-folder', (_event, filePath: string) => {
      shell.showItemInFolder(filePath);
    });

    registerYtdlpUpdateHandlers(ipcMain, getYtdlpUpdateController());
  }
}

export function createIpcBridgeModule(opts?: { isPortable?: boolean }) {
  return new IpcBridge(opts);
}
