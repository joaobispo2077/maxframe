import { mutationFloorProof } from '@src/domain/proof/mutationFloorProof';
import { describe, expect, it } from 'vitest';

describe('mutation floor proof', () => {
  it('returns the input when every branch stays closed', () => {
    expect(mutationFloorProof(0)).toBe(0);
  });
});
