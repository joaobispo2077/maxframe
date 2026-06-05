import type { AnalyzeVideoResult } from '../lib/analyzeVideoResultType.js';

import { Box, HStack, Image, Text, VStack } from '@chakra-ui/react';

import { youtubeThumbnailUrl } from '../lib/youtubeThumbnailUrl.js';
import { slideUpRevealStyles } from '../theme/motionStyles.js';

type VideoPreviewCardProps = {
  result: AnalyzeVideoResult;
};

export function VideoPreviewCard({ result }: VideoPreviewCardProps) {
  const videoId = result.videoId;
  const thumbnailSrc = videoId ? youtubeThumbnailUrl(videoId) : undefined;

  return (
    <Box
      role="region"
      aria-label="video-preview"
      css={slideUpRevealStyles}
      p={4}
      borderRadius="md"
      borderWidth="1px"
      borderColor="border"
      bg="surface.elevated"
    >
      <HStack gap={4} align="start" flexWrap="wrap">
        {thumbnailSrc ? (
          <Image
            src={thumbnailSrc}
            alt=""
            w="160px"
            h="90px"
            objectFit="cover"
            borderRadius="md"
            flexShrink={0}
          />
        ) : null}
        <VStack align="start" gap={1} flex="1" minW={0}>
          <Text fontWeight="semibold" fontSize="md" lineClamp={2}>
            {result.title || 'Untitled video'}
          </Text>
          <Text fontSize="sm" color="fg.muted" lineClamp={1}>
            {result.uploader || 'Unknown channel'}
          </Text>
          {videoId ? (
            <Text fontSize="xs" color="fg.muted" fontFamily="mono">
              {videoId}
            </Text>
          ) : null}
        </VStack>
      </HStack>
    </Box>
  );
}
