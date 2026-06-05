import type { SystemStyleObject } from '@chakra-ui/react';

const reducedMotionStyles: SystemStyleObject = {
  '@media (prefers-reduced-motion: reduce)': {
    animation: 'none',
    transition: 'none',
  },
};

export const slideUpRevealStyles: SystemStyleObject = {
  '@keyframes maxframe-slideUp': {
    from: { opacity: 0, transform: 'translateY(16px)' },
    to: { opacity: 1, transform: 'translateY(0)' },
  },
  animation: 'maxframe-slideUp 0.3s ease-out',
  ...reducedMotionStyles,
};

export const fadeSlideInRevealStyles: SystemStyleObject = {
  '@keyframes maxframe-fadeSlideIn': {
    from: { opacity: 0, transform: 'translateY(-6px)' },
    to: { opacity: 1, transform: 'translateY(0)' },
  },
  animation: 'maxframe-fadeSlideIn 0.25s ease-out',
  ...reducedMotionStyles,
};
