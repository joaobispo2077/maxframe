let active = false;

export function setDebugMode(on: boolean): void {
  active = on;
}

export function isDebugModeActive(): boolean {
  return active;
}
