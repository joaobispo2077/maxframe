import { contextBridge } from 'electron';

import * as exports from './index.js';

const isExport = (key: string): key is keyof typeof exports =>
  Object.hasOwn(exports, key);

for (const exportsKey in exports) {
  if (isExport(exportsKey)) {
    contextBridge.exposeInMainWorld(btoa(exportsKey), exports[exportsKey]);
  }
}

contextBridge.exposeInMainWorld('maxframeApi', exports);

// Re-export for tests
export * from './index.js';
