import type { YtdlpCopySource } from '@src/domain/ytdlp/ytdlpUpdateView.js';

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
import {
  YTDLP_CHECK_NOW_BUTTON,
  YTDLP_LAUNCH_DISCLOSURE,
  YTDLP_SETTINGS_VERSION_LABEL,
  ytdlpSourceLabel,
} from '@src/domain/ytdlp/ytdlpUpdateCopy.js';
import { YTDLP_LAUNCH_CHECK_DISCLOSURE } from '@src/domain/ytdlp/ytdlpUpdatePolicy.js';

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
  ytdlpVersion?: string;
  ytdlpSource?: YtdlpCopySource;
  showYtdlpDisclosure?: boolean;
  showYtdlpCheckNow?: boolean;
  onCheckYtdlpNow?: () => void;
};

/**
 * App preferences shell (paths, behavior). Filled in as settings are implemented.
 */
export function SettingsPage({
  onBack,
  embedded = false,
  defaultOutputMode = 'mp4',
  onDefaultOutputModeChange,
  ytdlpVersion,
  ytdlpSource,
  showYtdlpDisclosure,
  showYtdlpCheckNow = false,
  onCheckYtdlpNow,
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
      <HStack justify="space-between" align="center" flexWrap="wrap" gap={3}>
        <Heading size="lg" letterSpacing="tight">
          Settings
        </Heading>
        <SettingsBackButton embedded={embedded} onBack={onBack} />
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
                <option value="mp4">MP4 video</option>
                <option value="mp3">MP3 audio only</option>
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
            <Field.HelperText fontSize="xs" color="fg.muted">
              Applied to the Analyze tab output selector immediately.
            </Field.HelperText>
          </Field.Root>

          <YtdlpVersionSetting
            version={ytdlpVersion}
            source={ytdlpSource}
            showDisclosure={launchDisclosureVisible(showYtdlpDisclosure)}
            showCheckNow={showYtdlpCheckNow}
            onCheckNow={onCheckYtdlpNow}
          />

          <Box>
            <Text fontWeight="medium" fontSize="sm">
              Last save folder
            </Text>
            <Text
              fontSize="xs"
              color="fg.muted"
              mt={1}
              wordBreak="break-all"
              data-testid="output-folder"
            >
              {lastOutputFolder ??
                'No downloads yet. Completed files will show their folder here.'}
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
            <DebugModeToggle enabled={debugMode} onToggle={toggleDebugMode} />
          </HStack>

          <DebugLogPath
            debugMode={debugMode}
            logPath={logPath}
            onCopy={copyLogPath}
          />
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

function SettingsBackButton({
  embedded,
  onBack,
}: {
  embedded: boolean;
  onBack?: () => void;
}) {
  if (embedded || !onBack) {
    return null;
  }
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      colorPalette="purple"
      onClick={onBack}
    >
      Back
    </Button>
  );
}

function DebugModeToggle({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      size="sm"
      variant={enabled ? 'solid' : 'outline'}
      colorPalette={enabled ? 'orange' : 'purple'}
      onClick={onToggle}
    >
      {enabled ? 'On' : 'Off'}
    </Button>
  );
}

function DebugLogPath({
  debugMode,
  logPath,
  onCopy,
}: {
  debugMode: boolean;
  logPath: string | null;
  onCopy: () => void;
}) {
  if (!debugMode || !logPath) {
    return null;
  }
  return (
    <HStack
      bg="surface.elevated"
      borderRadius="md"
      px={3}
      py={2}
      gap={2}
      flexWrap="wrap"
    >
      <Text fontSize="xs" color="fg.muted" flex="1" wordBreak="break-all">
        Log file:{' '}
        <Text as="span" color="fg.muted" fontFamily="mono">
          {logPath}
        </Text>
      </Text>
      <Button
        size="xs"
        variant="ghost"
        colorPalette="purple"
        onClick={onCopy}
        flexShrink={0}
      >
        Copy path
      </Button>
    </HStack>
  );
}

function launchDisclosureVisible(explicit: boolean | undefined): boolean {
  return explicit ?? YTDLP_LAUNCH_CHECK_DISCLOSURE === 'settings-line';
}

function YtdlpVersionSetting({
  version,
  source,
  showDisclosure,
  showCheckNow,
  onCheckNow,
}: {
  version: string | undefined;
  source: YtdlpCopySource | undefined;
  showDisclosure: boolean;
  showCheckNow: boolean;
  onCheckNow?: () => void;
}) {
  const versionText = version
    ? `${YTDLP_SETTINGS_VERSION_LABEL}: ${version}${
        source ? ` (${ytdlpSourceLabel(source)})` : ''
      }`
    : `${YTDLP_SETTINGS_VERSION_LABEL}: Unknown`;
  return (
    <Box>
      <Text fontWeight="medium" fontSize="sm" data-testid="ytdlp-version">
        {versionText}
      </Text>
      {showDisclosure ? (
        <Text
          fontSize="xs"
          color="fg.muted"
          mt={1}
          data-testid="ytdlp-launch-disclosure"
        >
          {YTDLP_LAUNCH_DISCLOSURE}
        </Text>
      ) : null}
      {showCheckNow ? (
        <Button
          type="button"
          mt={2}
          size="sm"
          variant="outline"
          colorPalette="purple"
          onClick={onCheckNow}
        >
          {YTDLP_CHECK_NOW_BUTTON}
        </Button>
      ) : null}
    </Box>
  );
}
