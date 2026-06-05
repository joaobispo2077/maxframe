import {
  fadeSlideInRevealStyles,
  slideUpRevealStyles,
} from '@ui/theme/motionStyles';
import { describe, expect, it } from 'vitest';

describe('motionStyles', () => {
  it('defines slideUp animation with reduced-motion fallback', () => {
    expect(slideUpRevealStyles.animation).toContain('maxframe-slideUp');
    expect(slideUpRevealStyles['@keyframes maxframe-slideUp']).toBeDefined();
    expect(
      slideUpRevealStyles['@media (prefers-reduced-motion: reduce)'],
    ).toMatchObject({ animation: 'none' });
  });

  it('defines fadeSlideIn animation with reduced-motion fallback', () => {
    expect(fadeSlideInRevealStyles.animation).toContain('maxframe-fadeSlideIn');
    expect(fadeSlideInRevealStyles['@keyframes maxframe-fadeSlideIn']).toBeDefined();
    expect(
      fadeSlideInRevealStyles['@media (prefers-reduced-motion: reduce)'],
    ).toMatchObject({ animation: 'none' });
  });
});
