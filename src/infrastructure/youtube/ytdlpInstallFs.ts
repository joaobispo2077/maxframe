import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';

import { YtdlpUpdateFailure } from '../../domain/ytdlp/YtdlpUpdateFailure.js';

export type YtdlpFs = {
  mkdir: (path: string) => void;
  exists: (path: string) => boolean;
  readFile: (path: string) => Buffer;
  writeFile: (path: string, data: Buffer | string) => void;
  rename: (from: string, to: string) => void;
  rm: (path: string) => void;
  chmod: (path: string, mode: number) => void;
};

function asWriteError(error: unknown): YtdlpUpdateFailure {
  if (error instanceof YtdlpUpdateFailure) {
    return error;
  }
  const message = error instanceof Error ? error.message : String(error);
  return new YtdlpUpdateFailure('write', message);
}

export function createNodeYtdlpFs(): YtdlpFs {
  return {
    mkdir(path) {
      try {
        mkdirSync(path, { recursive: true });
      } catch (error) {
        throw asWriteError(error);
      }
    },
    exists(path) {
      return existsSync(path);
    },
    readFile(path) {
      try {
        return readFileSync(path);
      } catch (error) {
        throw asWriteError(error);
      }
    },
    writeFile(path, data) {
      try {
        writeFileSync(path, data);
      } catch (error) {
        throw asWriteError(error);
      }
    },
    rename(from, to) {
      try {
        renameSync(from, to);
      } catch (error) {
        throw asWriteError(error);
      }
    },
    rm(path) {
      try {
        rmSync(path, { force: true });
      } catch (error) {
        throw asWriteError(error);
      }
    },
    chmod(path, mode) {
      try {
        chmodSync(path, mode);
      } catch (error) {
        throw asWriteError(error);
      }
    },
  };
}
