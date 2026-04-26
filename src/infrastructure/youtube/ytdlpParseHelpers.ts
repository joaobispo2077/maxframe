export type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

export function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return undefined;
}

export function asString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  return undefined;
}

export function formatIdFromEntry(entry: UnknownRecord): string | undefined {
  const formatIdRaw = entry.format_id;
  if (typeof formatIdRaw === 'string' || typeof formatIdRaw === 'number') {
    return String(formatIdRaw);
  }
  return undefined;
}
