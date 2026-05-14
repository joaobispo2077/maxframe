import { Button, HStack, Text } from '@chakra-ui/react';

type SaveMessageBannerProps = {
  downloadNote: string | undefined;
  savedPath: string | undefined;
  onDismiss: () => void;
};

export function SaveMessageBanner({
  downloadNote,
  savedPath,
  onDismiss,
}: SaveMessageBannerProps) {
  if (!downloadNote) {
    return null;
  }

  return (
    <HStack
      role="status"
      justify="space-between"
      gap={3}
      p={3}
      borderRadius="md"
      bg="blackAlpha.500"
      borderWidth="1px"
      borderColor="green.700"
    >
      <Text fontSize="sm" flex="1">
        {downloadNote}
      </Text>
      <HStack gap={1}>
        {savedPath ? (
          <Button
            size="xs"
            variant="ghost"
            colorPalette="cyan"
            onClick={() => void window.maxframeApi.showItemInFolder(savedPath)}
            aria-label="Open containing folder"
          >
            Open folder
          </Button>
        ) : null}
        <Button
          size="xs"
          variant="ghost"
          onClick={onDismiss}
          aria-label="Dismiss save message"
        >
          Dismiss
        </Button>
      </HStack>
    </HStack>
  );
}
