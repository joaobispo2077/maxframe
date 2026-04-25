import {
  Box,
  Button,
  Card,
  Container,
  Heading,
  HStack,
  Text,
  VStack,
} from '@chakra-ui/react';

type SettingsPageProps = {
  onBack: () => void;
};

/**
 * App preferences shell (paths, behavior). Filled in as settings are implemented.
 */
export function SettingsPage({ onBack }: SettingsPageProps) {
  return (
    <Box minH="100vh" py={{ base: 6, md: 10 }} px={4}>
      <Container maxW="720px">
        <Card.Root
          bg="#0f141c"
          borderWidth="1px"
          borderColor="rgba(0, 240, 255, 0.22)"
          boxShadow="0 0 40px rgba(0, 240, 255, 0.06)"
          borderRadius="xl"
        >
          <Card.Body>
            <VStack gap={6} align="stretch">
              <HStack justify="space-between" align="center" flexWrap="wrap" gap={3}>
                <Heading size="lg" letterSpacing="tight">
                  Settings
                </Heading>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  colorPalette="cyan"
                  onClick={onBack}
                >
                  Back to home
                </Button>
              </HStack>
              <Text fontSize="sm" color="fg.muted" lineHeight="tall">
                Placeholder for upcoming options (e.g. yt-dlp / ffmpeg hints, defaults, and
                appearance). Use this screen to grow settings without crowding the analyze flow.
              </Text>
            </VStack>
          </Card.Body>
        </Card.Root>
      </Container>
    </Box>
  );
}
