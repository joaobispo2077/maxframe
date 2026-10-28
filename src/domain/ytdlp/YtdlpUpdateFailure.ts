export type YtdlpUpdateFailureReason = 'network' | 'checksum' | 'write';

export class YtdlpUpdateFailure extends Error {
  readonly reason: YtdlpUpdateFailureReason;

  constructor(reason: YtdlpUpdateFailureReason, message: string) {
    super(message);
    this.name = 'YtdlpUpdateFailure';
    this.reason = reason;
  }
}

export function asYtdlpNetworkFailure(error: unknown): YtdlpUpdateFailure {
  if (error instanceof YtdlpUpdateFailure) {
    return error;
  }
  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : String(error);
  if (name === 'TimeoutError' || name === 'AbortError') {
    return new YtdlpUpdateFailure('network', `timeout: ${message}`);
  }
  return new YtdlpUpdateFailure('network', message);
}
