import { useEffect, useState } from 'react';

import {
  Box,
  Button,
  Container,
  Field,
  Heading,
  HStack,
  NativeSelect,
  Text,
  VStack,
} from '@chakra-ui/react';

import { PanelCard } from '../components/PanelCard.js';
import {
  getLastOutputFolder,
  setDefaultOutputMode,
  type OutputMode,
} from '../lib/appPreferences.js';

type SettingsPageProps = {
  onBack?: () => void;
  embedded?: boolean;
  defaultOutputMode?: OutputMode;
  onDefaultOutputModeChange?: (mode: OutputMode) => void;
};

/**
 * App preferences shell (paths, behavior). Filled in as settings are implemented.
 */
export function SettingsPage({
  onBack,
  embedded = false,
  defaultOutputMode = 'mp4',
  onDefaultOutputModeChange,
}: SettingsPageProps) {
  const [debugMode, setDebugModeState] = useState(
    () => localStorage.getItem('maxframe.debugMode') === 'true',
  );
  const [logPath, setLogPath] = useState<string | null>(null);
  const lastOutputFolder = getLastOutputFolder();

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

  function handleDefaultOutputModeChange(mode: OutputMode) {
    setDefaultOutputMode(mode);
    onDefaultOutputModeChange?.(mode);
  }

  const content = (
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
        {!embedded && onBack ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            colorPalette="purple"
            onClick={onBack}
          >
            Back to home
          </Button>
        ) : null}
      </HStack>

      <Box borderTopWidth="1px" borderColor="border" pt={4}>
        <VStack align="stretch" gap={4}>
          <Heading size="sm">Preferences</Heading>
          <Field.Root>
            <Field.Label htmlFor="default-output-format">
              Default output format
            </Field.Label>
            <NativeSelect.Root colorPalette="purple">
              <NativeSelect.Field
                id="default-output-format"
                value={defaultOutputMode}
                onChange={(e) =>
                  handleDefaultOutputModeChange(e.target.value as OutputMode)
                }
                bg="blackAlpha.400"
                borderColor="border"
                fontSize="sm"
              >
                <option value="mp4">MP4 (best video)</option>
                <option value="mp3">MP3 (best audio)</option>
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
            <Field.HelperText fontSize="xs" color="fg.muted">
              Applied to the Analyze tab output selector immediately.
            </Field.HelperText>
          </Field.Root>

          <Box>
            <Text fontWeight="medium" fontSize="sm">
              Last save folder
            </Text>
            <Text fontSize="xs" color="fg.muted" mt={1} wordBreak="break-all">
              {lastOutputFolder ??
                'No downloads yet — completed files will show their folder here.'}
            </Text>
          </Box>
        </VStack>
      </Box>

      <Box borderTopWidth="1px" borderColor="border" pt={4}>
        <VStack align="stretch" gap={3}>
          <Heading size="sm">Developer</Heading>
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
              colorPalette={debugMode ? 'orange' : 'purple'}
              onClick={toggleDebugMode}
            >
              {debugMode ? 'On' : 'Off'}
            </Button>
          </HStack>

          {debugMode && logPath && (
            <HStack
              bg="surface.elevated"
              borderRadius="md"
              px={3}
              py={2}
              gap={2}
              flexWrap="wrap"
            >
              <Text
                fontSize="xs"
                color="fg.muted"
                flex="1"
                wordBreak="break-all"
              >
                Log file:{' '}
                <Text as="span" color="fg.muted" fontFamily="mono">
                  {logPath}
                </Text>
              </Text>
              <Button
                size="xs"
                variant="ghost"
                colorPalette="purple"
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
  );

  if (embedded) {
    return content;
  }

  return (
    <Box minH="100vh" py={{ base: 6, md: 10 }} px={4}>
      <Container maxW="960px">
        <PanelCard>{content}</PanelCard>
      </Container>
    </Box>
  );
}
