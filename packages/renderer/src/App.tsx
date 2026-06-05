import { useEffect, useState } from 'react';

import { AppNav } from './components/AppNav.js';
import { AppShell } from './components/AppShell.js';
import { useActiveDownload } from './hooks/useActiveDownload.js';
import { useAnalyzeFlow } from './hooks/useAnalyzeFlow.js';
import { useAppNavigation } from './hooks/useAppNavigation.js';
import { setDefaultOutputMode } from './lib/appPreferences.js';
import { useDownloadQueue } from './hooks/useDownloadQueue.js';
import { useQueueRunner } from './hooks/useQueueRunner.js';
import { PAGE_SUBTITLES } from './lib/pageSubtitles.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { AnalyzeView } from './views/AnalyzeView.js';
import { QueueView } from './views/QueueView.js';

function App() {
  const { activeTab, setActiveTab } = useAppNavigation('analyze');
  const [isPortable, setIsPortable] = useState(false);
  const [titleBarInset, setTitleBarInset] = useState({
    height: 0,
    padLeft: 0,
    padRight: 0,
  });
  const [debugMode] = useState(
    () => localStorage.getItem('maxframe.debugMode') === 'true',
  );

  const queue = useDownloadQueue();
  const analyze = useAnalyzeFlow({
    enqueueBulkText: queue.enqueueBulkText,
    debugMode,
  });

  const download = useActiveDownload({
    result: analyze.result,
    outputMode: analyze.outputMode,
    debugMode,
    setError: analyze.setError,
    setDiagnosticsReport: analyze.setDiagnosticsReport,
    setReportCopied: analyze.setReportCopied,
  });

  const runner = useQueueRunner({
    model: queue.model,
    dispatch: queue.dispatch,
    outputMode: analyze.outputMode,
    downloadBusy: download.downloadBusy,
  });

  useEffect(() => {
    window.maxframeApi
      ?.getInitialAppState?.()
      .then((s) => {
        setIsPortable(s.isPortable ?? false);
        setTitleBarInset(
          s.titleBarInset ?? { height: 0, padLeft: 0, padRight: 0 },
        );
      })
      .catch(() => {});
  }, []);

  async function handleAnalyze(): Promise<void> {
    download.clearSaveMessage();
    download.setHoveredFormatId(null);
    await analyze.analyzeUrl();
  }

  return (
    <AppShell
      isPortable={isPortable}
      titleBarInset={titleBarInset}
      subtitle={PAGE_SUBTITLES[activeTab]}
      onGoHome={() => setActiveTab('analyze')}
      headerActions={<AppNav activeTab={activeTab} onChange={setActiveTab} />}
    >
      {activeTab === 'analyze' ? (
        <AnalyzeView
          analyze={analyze}
          download={download}
          debugMode={debugMode}
          queueRunnerActive={runner.running}
          onAnalyze={handleAnalyze}
        />
      ) : null}
      {activeTab === 'queue' ? (
        <QueueView
          queue={queue}
          runner={{
            running: runner.running,
            canStart:
              queue.model.jobs.length > 0 &&
              !runner.running &&
              !download.downloadBusy,
            start: runner.start,
            stop: runner.stop,
          }}
        />
      ) : null}
      {activeTab === 'settings' ? (
        <SettingsPage
          embedded
          defaultOutputMode={analyze.outputMode}
          onDefaultOutputModeChange={(mode) => {
            setDefaultOutputMode(mode);
            analyze.setOutputMode(mode);
          }}
        />
      ) : null}
    </AppShell>
  );
}

export default App;
