import {
  Button,
  Field,
  HStack,
  Stack,
  Textarea,
} from '@chakra-ui/react';

import { ActiveDownloadPanel } from '../components/ActiveDownloadPanel.js';
import { AnalyzeErrorBanner } from '../components/AnalyzeErrorBanner.js';
import { AnalyzingIndicator } from '../components/AnalyzingIndicator.js';
import { DownloadBestButton } from '../components/DownloadBestButton.js';
import { OutputFormatSelect } from '../components/OutputFormatSelect.js';
import { QualityResultsPanel } from '../components/QualityResultsPanel.js';
import { SaveMessageBanner } from '../components/SaveMessageBanner.js';
import { VideoPreviewCard } from '../components/VideoPreviewCard.js';
import type { useActiveDownload } from '../hooks/useActiveDownload.js';
import type { useAnalyzeFlow } from '../hooks/useAnalyzeFlow.js';

type AnalyzeFlow = ReturnType<typeof useAnalyzeFlow>;
type ActiveDownload = ReturnType<typeof useActiveDownload>;

type AnalyzeViewProps = {
  analyze: AnalyzeFlow;
  download: ActiveDownload;
  debugMode: boolean;
  onAnalyze: () => Promise<void>;
};

export function AnalyzeView({
  analyze,
  download,
  debugMode,
  onAnalyze,
}: AnalyzeViewProps) {
  return (
    <Stack gap={4} align="stretch" minW={0}>
      <Field.Root>
        <Field.Label htmlFor="unified-queue-urls">Video URLs</Field.Label>
        <Textarea
          id="unified-queue-urls"
          value={analyze.urlsText}
          onChange={(e) => analyze.setUrlsText(e.target.value)}
          placeholder={
            'https://www.youtube.com/watch?v=...\nhttps://youtu.be/...'
          }
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
      <HStack gap={3} flexWrap="wrap" align="stretch">
        <Button
          flex={{ base: '1', sm: 'initial' }}
          colorPalette="purple"
          variant="surface"
          onClick={() => void onAnalyze()}
          disabled={
            analyze.analyzeTargetUrl === undefined ||
            analyze.loading ||
            download.downloadBusy
          }
          loading={analyze.loading}
          loadingText="Analyzing..."
        >
          Analyze quality
        </Button>
        <Button
          flex={{ base: '1', sm: 'initial' }}
          type="button"
          variant="outline"
          colorPalette="purple"
          onClick={analyze.handleAddToQueue}
          disabled={!analyze.canAddToQueue}
        >
          Add to queue
        </Button>
      </HStack>
      <AnalyzingIndicator visible={analyze.loading} />

      <AnalyzeErrorBanner
        error={analyze.error}
        debugMode={debugMode}
        diagnosticsReport={analyze.diagnosticsReport}
        onCopyReport={analyze.handleCopyReport}
        reportCopied={analyze.reportCopied}
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
            downloadBusy={download.downloadBusy}
            loading={analyze.loading}
            onDownload={download.downloadQuality}
          />
        </>
      ) : null}

      {analyze.result ? (
        <QualityResultsPanel
          result={analyze.result}
          outputMode={analyze.outputMode}
          downloadBusy={download.downloadBusy}
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
