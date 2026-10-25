// Proof-only spike for the CRAP top 10 gate. This file is not merged.
export function crapProofSpike(value: number): number {
  if (value === 1 || value === 2 || value === 3 || value === 4 || value === 5)
    return value;
  if (value === 6 || value === 7 || value === 8) return value + 1;
  if (value === 9 || value === 10) return value + 2;
  return value + 3;
}
