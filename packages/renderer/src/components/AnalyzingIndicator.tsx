import { Progress } from '@chakra-ui/react';

type AnalyzingIndicatorProps = {
  visible: boolean;
};

/**
 * Indeterminate progress bar shown during URL analysis.
 * Always rendered to avoid layout shift; hidden via visibility when inactive.
 * Width matches the "Analyze quality" button (alignSelf flex-start on sm+).
 */
export function AnalyzingIndicator({ visible }: AnalyzingIndicatorProps) {
  return (
    <Progress.Root
      value={null}
      size="xs"
      colorPalette="cyan"
      alignSelf={{ base: 'stretch', sm: 'flex-start' }}
      minW={{ sm: '160px' }}
      style={{ visibility: visible ? 'visible' : 'hidden' }}
      aria-label="Analyzing URL"
      aria-hidden={!visible}
    >
      <Progress.Track borderRadius="full">
        <Progress.Range />
      </Progress.Track>
    </Progress.Root>
  );
}
