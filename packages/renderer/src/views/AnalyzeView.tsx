import type { useActiveDownload } from '../hooks/useActiveDownload.js';
import type { useAnalyzeFlow } from '../hooks/useAnalyzeFlow.js';

import { Button, Field, HStack, Stack, Text, Textarea } from '@chakra-ui/react';

import { ActiveDownloadPanel } from '../components/ActiveDownloadPanel.js';
import { AnalyzeErrorBanner } from '../components/AnalyzeErrorBanner.js';
import { AnalyzingIndicator } from '../components/AnalyzingIndicator.js';
import { DownloadBestButton } from '../components/DownloadBestButton.js';
import { OutputFormatSelect } from '../components/OutputFormatSelect.js';
import { QualityResultsPanel } from '../components/QualityResultsPanel.js';
import { SaveMessageBanner } from '../components/SaveMessageBanner.js';
import { VideoPreviewCard } from '../components/VideoPreviewCard.js';
import { ANALYZE_URLS_HELPER } from '../lib/pageSubtitles.js';
import { isPlaylistLink, PLAYLIST_NOTICE } from '../lib/playlistNotice.js';

type AnalyzeFlow = ReturnType<typeof useAnalyzeFlow>;
type ActiveDownload = ReturnType<typeof useActiveDownload>;

type AnalyzeViewProps = {
  analyze: AnalyzeFlow;
  download: ActiveDownload;
  queueRunnerActive: boolean;
  onAnalyze: () => Promise<void>;
  onRetryDownload?: () => void;
  showYtdlpUpdate?: boolean;
  ytdlpUpdateBlocked?: boolean;
  onUpdateYtdlp?: () => void;
};

function analyzeButtonDisabled(
  analyze: AnalyzeFlow,
  download: ActiveDownload,
): boolean {
  return (
    analyze.analyzeTargetUrl === undefined ||
    analyze.loading ||
    download.downloadBusy
  );
}

export function AnalyzeView({
  analyze,
  download,
  queueRunnerActive,
  onAnalyze,
  onRetryDownload,
  showYtdlpUpdate = false,
  ytdlpUpdateBlocked = false,
  onUpdateYtdlp,
}: AnalyzeViewProps) {
  const playlistLink =
    isPlaylistLink(analyze.analyzeTargetUrl) ||
    isPlaylistLink(analyze.result?.url);
  return (
    <Stack gap={4} align="stretch" minW={0}>
      <Field.Root>
        <Field.Label htmlFor="unified-queue-urls">YouTube links</Field.Label>
        <Field.HelperText fontSize="sm" color="fg.muted">
          {ANALYZE_URLS_HELPER}
        </Field.HelperText>
        <Textarea
          id="unified-queue-urls"
          data-testid="link-input"
          value={analyze.urlsText}
          onChange={(e) => analyze.setUrlsText(e.target.value)}
          placeholder={'https://www.youtube.com/watch?v=…\nhttps://youtu.be/…'}
          rows={4}
          resize="vertical"
          w="100%"
          minW={0}
          overflowWrap="anywhere"
          bg="blackAlpha.400"
          borderColor="border"
          fontSize="sm"
          _focusVisible={{
            borderColor: 'purple.400',
            boxShadow: '0 0 0 1px var(--chakra-colors-purple-400)',
          }}
        />
      </Field.Root>
      <OutputFormatSelect
        value={analyze.outputMode}
        onChange={analyze.setOutputMode}
      />
      {playlistLink ? (
        <Text
          role="status"
          data-testid="playlist-notice"
          fontSize="sm"
          color="fg.muted"
        >
          {PLAYLIST_NOTICE}
        </Text>
      ) : null}
      <HStack gap={3} flexWrap="wrap" align="stretch">
        <Button
          flex={{ base: '1', sm: 'initial' }}
          data-testid="check-quality-button"
          colorPalette="purple"
          variant="surface"
          onClick={() => void onAnalyze()}
          disabled={analyzeButtonDisabled(analyze, download)}
          loading={analyze.loading}
          loadingText="Checking…"
        >
          {analyze.linkCount >= 2 ? 'Check first link' : 'Check quality'}
        </Button>
        <Button
          flex={{ base: '1', sm: 'initial' }}
          type="button"
          variant="outline"
          colorPalette="purple"
          onClick={analyze.handleAddToQueue}
          disabled={!analyze.canAddToQueue}
        >
          Add {analyze.linkCount} to queue
        </Button>
      </HStack>
      <AnalyzingIndicator visible={analyze.loading} />

      <AnalyzeErrorBanner
        error={analyze.error}
        diagnosticsReport={analyze.diagnosticsReport}
        onCopyReport={analyze.handleCopyReport}
        reportCopied={analyze.reportCopied}
        onRetry={onRetryDownload}
        showYtdlpUpdate={showYtdlpUpdate}
        updateBlocked={ytdlpUpdateBlocked}
        onUpdateYtdlp={onUpdateYtdlp}
      />

      <SaveMessageBanner
        downloadNote={download.downloadNote}
        savedPath={download.savedPath}
        onDismiss={download.clearSaveMessage}
      />

      <ActiveDownloadPanel
        visible={download.downloadBusy}
        progress={download.progress}
        onCancel={() => void download.cancelActiveDownload()}
      />

      {analyze.result ? (
        <>
          <VideoPreviewCard result={analyze.result} />
          <DownloadBestButton
            result={analyze.result}
            outputMode={analyze.outputMode}
            downloadBusy={download.downloadBusy || queueRunnerActive}
            loading={analyze.loading}
            onDownload={download.downloadQuality}
          />
        </>
      ) : null}

      {analyze.result ? (
        <QualityResultsPanel
          result={analyze.result}
          outputMode={analyze.outputMode}
          downloadBusy={download.downloadBusy || queueRunnerActive}
          loading={analyze.loading}
          hoveredFormatId={download.hoveredFormatId}
          downloadFormatId={download.downloadFormatId}
          onHoverChange={download.setHoveredFormatId}
          onDownloadQuality={download.downloadQuality}
        />
      ) : null}
    </Stack>
  );
}
