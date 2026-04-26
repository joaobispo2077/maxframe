import type { AppInitConfig } from './AppInitConfig.js';

import { app } from 'electron';
import { join } from 'node:path';
import { createModuleRunner } from './ModuleRunner.js';
import { terminateAppOnLastWindowClose } from './modules/ApplicationTerminatorOnLastWindowClose.js';
import { autoUpdater } from './modules/AutoUpdater.js';
import { allowInternalOrigins } from './modules/BlockNotAllowdOrigins.js';
import { allowExternalUrls } from './modules/ExternalUrls.js';
import { hardwareAccelerationMode } from './modules/HardwareAccelerationModule.js';
import { createIpcBridgeModule } from './modules/IpcBridge.js';
import { disallowMultipleAppInstance } from './modules/SingleInstanceApp.js';
import { createWindowManagerModule } from './modules/WindowManager.js';

export async function initApp(initConfig: AppInitConfig) {
  const ciSmokeMode = process.env.MAXFRAME_CI_SMOKE === '1';

  // Must be called before any module reads app.getPath('userData').
  // electron-builder sets PORTABLE_EXECUTABLE_DIR before app code runs when launching the portable exe.
  const isPortable = Boolean(process.env.PORTABLE_EXECUTABLE_DIR);
  if (isPortable) {
    app.setPath('userData', join(process.env.PORTABLE_EXECUTABLE_DIR!, 'MaxframeData'));
  }

  let moduleRunner = createModuleRunner()
    .init(
      createWindowManagerModule({
        initConfig,
        openDevTools: import.meta.env.DEV,
        isPortable,
      }),
    )
    .init(disallowMultipleAppInstance())
    .init(terminateAppOnLastWindowClose())
    .init(hardwareAccelerationMode({ enable: false }))
    .init(createIpcBridgeModule({ isPortable }))

    // Install DevTools extension if needed
    // .init(chromeDevToolsExtension({extension: 'VUEJS3_DEVTOOLS'}))

    // Security
    .init(
      allowInternalOrigins(
        new Set(
          initConfig.renderer instanceof URL
            ? [initConfig.renderer.origin]
            : [],
        ),
      ),
    )
    .init(
      allowExternalUrls(
        new Set(
          initConfig.renderer instanceof URL ? ['https://maxframe.app'] : [],
        ),
      ),
    );

  // Skip auto-updater in CI smoke and in portable mode.
  // Portable: update payloads would land next to the exe on the external drive, breaking the package.
  if (!ciSmokeMode && !isPortable) {
    moduleRunner = moduleRunner.init(autoUpdater());
  }

  await moduleRunner;
}
