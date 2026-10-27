const SUM_LINE = /^([0-9a-fA-F]{64})\s+\*?(\S+)$/;

/**
 * SHA-256 for one asset in a SHA2-256SUMS file.
 * Undefined when the asset is missing or listed more than once.
 */
export function sha256ForAsset(
  sumsText: string,
  assetName: string,
): string | undefined {
  const matches: string[] = [];
  for (const rawLine of sumsText.split(/\r?\n/)) {
    const found = hashOnLine(rawLine, assetName);
    if (found) {
      matches.push(found);
    }
  }
  if (matches.length !== 1) {
    return undefined;
  }
  return matches[0];
}

function hashOnLine(rawLine: string, assetName: string): string | undefined {
  const line = rawLine.trim();
  if (!line) {
    return undefined;
  }
  const match = SUM_LINE.exec(line);
  if (!match?.[1] || match[2] !== assetName) {
    return undefined;
  }
  return match[1].toLowerCase();
}

export function sha256Equals(actual: string, expected: string): boolean {
  return actual.toLowerCase() === expected.toLowerCase();
}
