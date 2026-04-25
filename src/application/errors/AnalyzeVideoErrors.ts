export class AnalyzeVideoUrlError extends Error {
  constructor(
    public readonly code: 'INVALID_URL' | 'METADATA_UNAVAILABLE',
    message: string,
  ) {
    super(message);
    this.name = 'AnalyzeVideoUrlError';
  }
}
