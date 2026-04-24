import type { AppModule } from "../AppModule.js";
import type { ModuleContext } from "../ModuleContext.js";
import { ipcMain } from "electron";

const CHANNEL_GET_INITIAL_STATE = "app:get-initial-state";
const CHANNEL_PING = "app:ping";

class IpcBridge implements AppModule {
  enable(_context: ModuleContext): void {
    ipcMain.handle(CHANNEL_GET_INITIAL_STATE, () => ({
      appName: "Maxframe",
      status: "ready",
    }));

    ipcMain.handle(CHANNEL_PING, (_event, payload: string) => payload);
  }
}

export function createIpcBridgeModule() {
  return new IpcBridge();
}
