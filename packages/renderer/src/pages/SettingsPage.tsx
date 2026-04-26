import { useEffect, useState } from 'react';

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
  const [debugMode, setDebugModeState] = useState(
    () => localStorage.getItem('maxframe.debugMode') === 'true',
  );
  const [logPath, setLogPath] = useState<string | null>(null);

  useEffect(() => {
    void window.maxframeApi.getLogPath().then(setLogPath);
  }, []);

  function toggleDebugMode() {
    const next = !debugMode;
    setDebugModeState(next);
    localStorage.setItem('maxframe.debugMode', String(next));
    void window.maxframeApi.setDebugMode(next);
  }

  function copyLogPath() {
    if (logPath) {
      void navigator.clipboard.writeText(logPath);
    }
  }

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
              <HStack
                justify="space-between"
                align="center"
                flexWrap="wrap"
                gap={3}
              >
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
                Placeholder for upcoming options (e.g. yt-dlp / ffmpeg hints,
                defaults, and appearance). Use this screen to grow settings
                without crowding the analyze flow.
              </Text>
                <Box
                borderTopWidth="1px"
                borderColor="whiteAlpha.200"
                pt={4}
              >
                <VStack align="stretch" gap={3}>
                  <HStack justify="space-between" align="center">
                    <VStack align="start" gap={0}>
                      <Text fontWeight="medium">Debug mode</Text>
                      <Text fontSize="xs" color="fg.muted">
                        Shows detailed error info and writes logs to{' '}
                        <Text as="strong" color="fg">
                          maxframe-debug.log
                        </Text>{' '}
                        when something goes wrong.
                      </Text>
                    </VStack>
                    <Button
                      size="sm"
                      variant={debugMode ? 'solid' : 'outline'}
                      colorPalette={debugMode ? 'orange' : 'cyan'}
                      onClick={toggleDebugMode}
                    >
                      {debugMode ? 'On' : 'Off'}
                    </Button>
                  </HStack>

                  {debugMode && logPath && (
                    <HStack
                      bg="whiteAlpha.50"
                      borderRadius="md"
                      px={3}
                      py={2}
                      gap={2}
                      flexWrap="wrap"
                    >
                      <Text fontSize="xs" color="fg.muted" flex="1" wordBreak="break-all">
                        Log file:{' '}
                        <Text as="span" color="fg.subtle" fontFamily="mono">
                          {logPath}
                        </Text>
                      </Text>
                      <Button
                        size="xs"
                        variant="ghost"
                        colorPalette="cyan"
                        onClick={copyLogPath}
                        flexShrink={0}
                      >
                        Copy path
                      </Button>
                    </HStack>
                  )}
                </VStack>
              </Box>
            </VStack>
          </Card.Body>
        </Card.Root>
      </Container>
    </Box>
  );
}
