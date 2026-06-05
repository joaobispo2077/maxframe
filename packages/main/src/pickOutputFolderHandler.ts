import { BrowserWindow, dialog } from 'electron';

export type PickOutputFolderResult =
  | { canceled: true }
  | { canceled: false; folderPath: string };

export async function pickOutputFolderHandler(): Promise<PickOutputFolderResult> {
  const parentWindow = BrowserWindow.getFocusedWindow();
  const dialogOptions = {
    properties: ['openDirectory', 'createDirectory'] as const,
  };
  const { canceled, filePaths } = parentWindow
    ? await dialog.showOpenDialog(parentWindow, dialogOptions)
    : await dialog.showOpenDialog(dialogOptions);

  if (canceled || filePaths.length === 0 || !filePaths[0]) {
    return { canceled: true };
  }

  return { canceled: false, folderPath: filePaths[0] };
}
