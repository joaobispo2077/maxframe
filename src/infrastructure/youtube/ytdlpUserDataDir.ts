let userDataDir: string | undefined;

export function setYtdlpUserDataDir(dir: string): void {
  userDataDir = dir;
}

export function readYtdlpUserDataDir(): string | undefined {
  return userDataDir;
}
