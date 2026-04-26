let lastError: string | undefined;

export function recordError(raw: string): void {
  lastError = raw;
}

export function clearError(): void {
  lastError = undefined;
}

export function getLastError(): string | undefined {
  return lastError;
}
