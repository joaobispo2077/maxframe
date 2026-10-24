/** First trimmed non-empty line. Used for Check quality while the field holds several links. */
export function firstNonEmptyLine(blob: string): string | undefined {
  for (const line of blob.split(/\r?\n/)) {
    const t = line.trim();
    if (t.length > 0) {
      return t;
    }
  }
  return undefined;
}

/** Non-empty lines in the link field. Blank lines are not links. */
export function countNonEmptyLines(blob: string): number {
  let count = 0;
  for (const line of blob.split(/\r?\n/)) {
    if (line.trim().length > 0) {
      count += 1;
    }
  }
  return count;
}
