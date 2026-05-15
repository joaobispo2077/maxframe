let lastError: string | undefined;
let lastErrorDetail: string | undefined;
let lastSubmittedUrl: string | undefined;

export function recordSubmittedUrl(url: string): void {
  lastSubmittedUrl = url;
}

export function recordError(raw: string, detail?: string): void {
  lastError = raw;
  lastErrorDetail = detail;
}

export function clearError(): void {
  lastError = undefined;
  lastErrorDetail = undefined;
  lastSubmittedUrl = undefined;
}

export function getLastError(): string | undefined {
  return lastError;
}

export function getLastErrorDetail(): string | undefined {
  return lastErrorDetail;
}

export function getLastSubmittedUrl(): string | undefined {
  return lastSubmittedUrl;
}
