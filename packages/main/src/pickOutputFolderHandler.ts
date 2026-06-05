import { BrowserWindow, dialog, type OpenDialogOptions } from 'electron';

export type PickOutputFolderResult =
  | { canceled: true }
  | { canceled: false; folderPath: string };

export async function pickOutputFolderHandler(): Promise<PickOutputFolderResult> {
  const parentWindow = BrowserWindow.getFocusedWindow();
  const dialogOptions: OpenDialogOptions = {
    properties: ['openDirectory', 'createDirectory'],
  };
  const { canceled, filePaths } = parentWindow
    ? await dialog.showOpenDialog(parentWindow, dialogOptions)
    : await dialog.showOpenDialog(dialogOptions);

  if (canceled || filePaths.length === 0 || !filePaths[0]) {
    return { canceled: true };
  }

  return { canceled: false, folderPath: filePaths[0] };
}
