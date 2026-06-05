import { beforeEach, describe, expect, it, vi } from 'vitest';

const showOpenDialogMock = vi.fn();
const getFocusedWindowMock = vi.fn();

vi.mock('electron', () => ({
  BrowserWindow: { getFocusedWindow: getFocusedWindowMock },
  dialog: { showOpenDialog: showOpenDialogMock },
}));

describe('pickOutputFolderHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getFocusedWindowMock.mockReturnValue(null);
  });

  it('returns canceled when user dismisses the dialog', async () => {
    showOpenDialogMock.mockResolvedValue({ canceled: true, filePaths: [] });

    const { pickOutputFolderHandler } = await import(
      '../../packages/main/src/pickOutputFolderHandler'
    );

    const result = await pickOutputFolderHandler();

    expect(result).toEqual({ canceled: true });
  });

  it('returns folderPath when user picks a directory', async () => {
    showOpenDialogMock.mockResolvedValue({
      canceled: false,
      filePaths: ['C:\\Videos\\Maxframe'],
    });

    const { pickOutputFolderHandler } = await import(
      '../../packages/main/src/pickOutputFolderHandler'
    );

    const result = await pickOutputFolderHandler();

    expect(result).toEqual({
      canceled: false,
      folderPath: 'C:\\Videos\\Maxframe',
    });
  });

  it('opens directory picker with createDirectory enabled', async () => {
    showOpenDialogMock.mockResolvedValue({
      canceled: false,
      filePaths: ['C:\\Videos'],
    });

    const { pickOutputFolderHandler } = await import(
      '../../packages/main/src/pickOutputFolderHandler'
    );

    await pickOutputFolderHandler();

    const dialogOptions = showOpenDialogMock.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(dialogOptions.properties).toEqual([
      'openDirectory',
      'createDirectory',
    ]);
  });
});
