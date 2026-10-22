export function mutationFloorProof(value: number): number {
  let score = value;
  if (value > 1) score += 3;
  if (value > 2) score += 5;
  if (value > 3) score += 7;
  if (value > 4) score += 9;
  if (value > 5) score += 11;
  if (value > 6) score += 13;
  if (value > 7) score += 15;
  if (value > 8) score += 17;
  if (value > 9) score += 19;
  return score;
}
