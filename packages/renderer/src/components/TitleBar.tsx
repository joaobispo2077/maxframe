import type { CSSProperties } from 'react';

import { Box } from '@chakra-ui/react';

export type TitleBarInset = {
  height: number;
  padLeft: number;
  padRight: number;
};

type TitleBarProps = TitleBarInset;

export function TitleBar({ height, padLeft, padRight }: TitleBarProps) {
  if (height <= 0) {
    return null;
  }

  const dragStyle: CSSProperties = {
    WebkitAppRegion: 'drag',
    userSelect: 'none',
  };

  return (
    <Box
      data-testid="title-bar-drag-region"
      position="fixed"
      top={0}
      left={0}
      right={0}
      zIndex={100}
      h={`${height}px`}
      pl={`${padLeft}px`}
      pr={`${padRight}px`}
      bg="surface.canvas"
      style={dragStyle}
    />
  );
}
