import type { YtdlpUpdateView } from '../../../src/domain/ytdlp/ytdlpUpdateView.js';

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { BrowserWindow, app } from 'electron';

import { writeLogEntry } from '../../../src/infrastructure/diagnostics/debugLogger.js';
import { fetchLatestYtdlpRelease } from '../../../src/infrastructure/youtube/fetchLatestYtdlpRelease.js';
import { installOfficialYtdlp } from '../../../src/infrastructure/youtube/installOfficialYtdlp.js';
import { probeYtdlpVersion } from '../../../src/infrastructure/youtube/probeYtdlpVersion.js';
import { resolveYtdlp } from '../../../src/infrastructure/youtube/resolveYtdlpExecutable.js';
import { isYtdlpBusy } from '../../../src/infrastructure/youtube/ytdlpBusy.js';
import { createNodeYtdlpFs } from '../../../src/infrastructure/youtube/ytdlpInstallFs.js';
import {
  createYtdlpUpdateController,
  type YtdlpUpdateController,
} from '../../../src/infrastructure/youtube/ytdlpUpdateController.js';
import { readYtdlpUserDataDir } from '../../../src/infrastructure/youtube/ytdlpUserDataDir.js';
import { YTDLP_UPDATE_CHANGED_CHANNEL } from '../../../src/interface/ipc/ytdlpUpdateChannels.js';

let controller: YtdlpUpdateController | undefined;

export function getYtdlpUpdateController(): YtdlpUpdateController {
  if (!controller) {
    controller = createYtdlpUpdateController({
      resolve: () => resolveYtdlp(),
      fetchLatest: (timeoutMs) => fetchLatestYtdlpRelease({ timeoutMs }),
      install: (version) =>
        installOfficialYtdlp({
          version,
          userDataDir: readYtdlpUserDataDir() ?? app.getPath('userData'),
          platform: process.platform,
          fs: createNodeYtdlpFs(),
          probeVersion: probeYtdlpVersion,
        }),
      probe: probeYtdlpVersion,
      log: (reason) => {
        writeLogEntry({ event: 'ytdlp-update-check', error: reason });
      },
      isBusy: isYtdlpBusy,
      env: process.env,
      loadDismissedLatest: readDismissedLatest,
      saveDismissedLatest: writeDismissedLatest,
      onChange: publishYtdlpUpdateView,
    });
  }
  return controller;
}

export function scheduleYtdlpLaunchCheck(): void {
  void getYtdlpUpdateController()
    .runLaunchCheck()
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      writeLogEntry({ event: 'ytdlp-update-check', error: message });
    });
}

function publishYtdlpUpdateView(view: YtdlpUpdateView): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) {
      continue;
    }
    win.webContents.send(YTDLP_UPDATE_CHANGED_CHANNEL, view);
  }
}

function dismissedPath(): string {
  const root = readYtdlpUserDataDir() ?? app.getPath('userData');
  return join(root, 'yt-dlp', 'dismissed-latest.txt');
}

function readDismissedLatest(): string | undefined {
  try {
    const text = readFileSync(dismissedPath(), 'utf8').trim();
    return text || undefined;
  } catch {
    return undefined;
  }
}

function writeDismissedLatest(version: string): void {
  const path = dismissedPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, version, 'utf8');
}
