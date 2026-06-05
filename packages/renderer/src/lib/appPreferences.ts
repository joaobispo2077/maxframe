const DEFAULT_OUTPUT_MODE_KEY = 'maxframe.defaultOutputMode';
const LAST_OUTPUT_FOLDER_KEY = 'maxframe.lastOutputFolder';

export type OutputMode = 'mp3' | 'mp4';

export function getDefaultOutputMode(): OutputMode {
  const stored = localStorage.getItem(DEFAULT_OUTPUT_MODE_KEY);
  return stored === 'mp3' ? 'mp3' : 'mp4';
}

export function setDefaultOutputMode(mode: OutputMode): void {
  localStorage.setItem(DEFAULT_OUTPUT_MODE_KEY, mode);
}

export function getLastOutputFolder(): string | undefined {
  const stored = localStorage.getItem(LAST_OUTPUT_FOLDER_KEY);
  return stored && stored.length > 0 ? stored : undefined;
}

export function setLastOutputFolder(folderPath: string): void {
  localStorage.setItem(LAST_OUTPUT_FOLDER_KEY, folderPath);
}

/** Extract parent directory from a saved file path (Windows or POSIX). */
export function parentFolderFromFilePath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const lastSlash = normalized.lastIndexOf('/');
  if (lastSlash <= 0) {
    return filePath;
  }
  return normalized.slice(0, lastSlash).replace(/\//g, '\\');
}
