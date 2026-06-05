import {
  fadeSlideInKeyframes,
  fadeSlideInRevealStyles,
  slideUpKeyframes,
  slideUpRevealStyles,
} from '@ui/theme/motionStyles';
import { describe, expect, it } from 'vitest';

describe('motionStyles', () => {
  it('defines slideUp animation with reduced-motion fallback', () => {
    expect(slideUpKeyframes).toBeDefined();
    expect(slideUpRevealStyles.animation).toContain('0.3s ease-out');
    expect(
      slideUpRevealStyles['@media (prefers-reduced-motion: reduce)'],
    ).toMatchObject({ animation: 'none' });
  });

  it('defines fadeSlideIn animation with reduced-motion fallback', () => {
    expect(fadeSlideInKeyframes).toBeDefined();
    expect(fadeSlideInRevealStyles.animation).toContain('0.25s ease-out');
    expect(
      fadeSlideInRevealStyles['@media (prefers-reduced-motion: reduce)'],
    ).toMatchObject({ animation: 'none' });
  });
});
