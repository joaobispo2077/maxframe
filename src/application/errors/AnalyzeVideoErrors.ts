export class AnalyzeVideoUrlError extends Error {
  readonly technicalDetail?: string;

  constructor(
    public readonly code: 'INVALID_URL' | 'METADATA_UNAVAILABLE',
    message: string,
    technicalDetail?: string,
  ) {
    super(message);
    this.name = 'AnalyzeVideoUrlError';
    this.technicalDetail = technicalDetail;
  }
}
