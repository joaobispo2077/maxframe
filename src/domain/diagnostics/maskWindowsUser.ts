const RESERVED_WINDOWS_PROFILES = new Set([
  'public',
  'default',
  'default user',
  'all users',
  'defaultaccount',
  'guest',
]);

function pathSegments(text: string): string[] {
  return text
    .replaceAll('\\', '/')
    .split('/')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function isSkippableProfileName(name: string): boolean {
  if (name === '.' || name === '..') {
    return true;
  }
  return RESERVED_WINDOWS_PROFILES.has(name.toLowerCase());
}

/** User-folder names found in Windows paths (`C:\\Users\\<name>`, `/Users/<name>`, `\\Users\\<name>`). */
export function windowsUserNamesIn(text: string): string[] {
  const parts = pathSegments(text);
  const found = new Map<string, string>();
  for (let index = 0; index < parts.length - 1; index += 1) {
    if (parts[index]?.toLowerCase() !== 'users') {
      continue;
    }
    const name = parts[index + 1];
    if (
      !name ||
      isSkippableProfileName(name) ||
      found.has(name.toLowerCase())
    ) {
      continue;
    }
    found.set(name.toLowerCase(), name);
  }
  return [...found.values()];
}

function isTokenBoundary(char: string): boolean {
  return char.length === 0 || !/[A-Za-z0-9._-]/.test(char);
}

function replaceUserToken(text: string, name: string): string {
  const needle = name.toLowerCase();
  const lower = text.toLowerCase();
  let result = '';
  let index = 0;
  while (index < text.length) {
    const foundAt = lower.indexOf(needle, index);
    if (foundAt < 0) {
      return result + text.slice(index);
    }
    const before = foundAt === 0 ? '' : text.charAt(foundAt - 1);
    const end = foundAt + name.length;
    const after = end >= text.length ? '' : text.charAt(end);
    if (isTokenBoundary(before) && isTokenBoundary(after)) {
      result += text.slice(index, foundAt) + '<user>';
    } else {
      result += text.slice(index, end);
    }
    index = end;
  }
  return result;
}

/** Replaces each detected Windows user name, including USERPROFILE / HOMEPATH / USERNAME values. */
export function maskKnownUserNames(
  text: string,
  names: readonly string[],
): string {
  let masked = text;
  for (const name of names) {
    masked = replaceUserToken(masked, name);
  }
  return masked;
}

export function maskWindowsUserText(text: string): string {
  return maskKnownUserNames(text, windowsUserNamesIn(text));
}

/** Last folder of a home directory, when it is a real profile name. */
export function profileNameFromHome(homeDir: string): string | undefined {
  const parts = pathSegments(homeDir);
  const name = parts[parts.length - 1];
  if (!name || isSkippableProfileName(name)) {
    return undefined;
  }
  return name;
}
