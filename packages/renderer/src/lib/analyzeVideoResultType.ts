/** Shape returned by `analyzeVideoUrl` for quality UI. */
export type AnalyzeVideoResult = Awaited<
  ReturnType<(typeof window)['maxframeApi']['analyzeVideoUrl']>
>;
