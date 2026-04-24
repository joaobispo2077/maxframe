import type { AppModule } from '../AppModule.js';
import type { ModuleContext } from '../ModuleContext.js';

import { ipcMain } from 'electron';
import { analyzeVideoHandler } from '../../../../src/interface/ipc/analyzeVideoHandler.js';

const CHANNEL_GET_INITIAL_STATE = 'app:get-initial-state';
const CHANNEL_PING = 'app:ping';
const CHANNEL_ANALYZE_VIDEO_URL = 'app:analyze-video-url';

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
  }
}

export function createIpcBridgeModule() {
  return new IpcBridge();
}
