import {
  appendFileSync,
  existsSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

import { app } from 'electron';

import { isDebugModeActive } from '../../interface/ipc/debugModeStore.js';

export type LogEntry = {
  ts?: string;
  event: string;
  ytdlpPath?: string;
  ffmpegPath?: string;
  ytdlpFound?: boolean;
  ffmpegFound?: boolean;
  error?: string;
  appVersion?: string;
  platform?: string;
};

const MAX_BYTES = 500 * 1024;
const MAX_LINES = 200;

export function writeLogEntry(entry: LogEntry): void {
  if (!isDebugModeActive()) return;

  const logPath = join(app.getPath('userData'), 'maxframe-debug.log');

  if (existsSync(logPath) && statSync(logPath).size > MAX_BYTES) {
    const lines = readFileSync(logPath, 'utf8').split('\n').filter(Boolean);
    writeFileSync(logPath, lines.slice(-MAX_LINES).join('\n') + '\n', 'utf8');
  }

  appendFileSync(
    logPath,
    JSON.stringify({ ...entry, ts: new Date().toISOString() }) + '\n',
    'utf8',
  );
}
