import {ipcRenderer} from 'electron';

export type InitialAppState = {
  appName: string;
  status: 'ready';
};

export async function getInitialAppState(): Promise<InitialAppState> {
  return ipcRenderer.invoke('app:get-initial-state');
}

export async function ping(payload: string): Promise<string> {
  return ipcRenderer.invoke('app:ping', payload);
}
