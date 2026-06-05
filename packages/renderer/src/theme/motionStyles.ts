import type { SystemStyleObject } from '@chakra-ui/react';
import { keyframes } from '@emotion/react';

export const slideUpKeyframes = keyframes`
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

export const fadeSlideInKeyframes = keyframes`
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const reducedMotionStyles: SystemStyleObject = {
  '@media (prefers-reduced-motion: reduce)': {
    animation: 'none',
    transition: 'none',
  },
};

export const slideUpRevealStyles: SystemStyleObject = {
  animation: `${slideUpKeyframes} 0.3s ease-out`,
  ...reducedMotionStyles,
};

export const fadeSlideInRevealStyles: SystemStyleObject = {
  animation: `${fadeSlideInKeyframes} 0.25s ease-out`,
  ...reducedMotionStyles,
};
