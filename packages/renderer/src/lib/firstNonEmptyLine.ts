/** First trimmed non-empty line — used for Analyze while textarea holds multiple URLs. */
export function firstNonEmptyLine(blob: string): string | undefined {
  for (const line of blob.split(/\r?\n/)) {
    const t = line.trim();
    if (t.length > 0) {
      return t;
    }
  }
  return undefined;
}
