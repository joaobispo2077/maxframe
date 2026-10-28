import { execFileSync } from 'node:child_process';

const cache = new Map<string, string | undefined>();

export function readBundledYtdlpVersion(
  executable: string,
): string | undefined {
  if (cache.has(executable)) {
    return cache.get(executable);
  }
  const version = runVersion(executable);
  cache.set(executable, version);
  return version;
}

export function clearBundledYtdlpVersionCache(): void {
  cache.clear();
}

function runVersion(executable: string): string | undefined {
  try {
    const stdout = execFileSync(executable, ['--version'], {
      timeout: 3_000,
      windowsHide: true,
      encoding: 'utf8',
    });
    const version = stdout.trim();
    return version ? version.slice(0, 120) : undefined;
  } catch {
    return undefined;
  }
}
