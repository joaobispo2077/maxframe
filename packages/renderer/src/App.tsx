import { useEffect, useState } from 'react';

import { AppNav } from './components/AppNav.js';
import { AppShell } from './components/AppShell.js';
import { useActiveDownload } from './hooks/useActiveDownload.js';
import { useAnalyzeFlow } from './hooks/useAnalyzeFlow.js';
import { useAppNavigation } from './hooks/useAppNavigation.js';
import { setDefaultOutputMode } from './lib/appPreferences.js';
import { useDownloadQueue } from './hooks/useDownloadQueue.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { AnalyzeView } from './views/AnalyzeView.js';
import { QueueView } from './views/QueueView.js';

function App() {
  const { activeTab, setActiveTab } = useAppNavigation('analyze');
  const [isPortable, setIsPortable] = useState(false);
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

  useEffect(() => {
    window.maxframeApi
      ?.getInitialAppState?.()
      .then((s) => setIsPortable(s.isPortable ?? false))
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
      subtitle="Paste YouTube URLs below — Analyze uses the first line; Add to queue saves every non-empty line."
      headerActions={<AppNav activeTab={activeTab} onChange={setActiveTab} />}
    >
      {activeTab === 'analyze' ? (
        <AnalyzeView
          analyze={analyze}
          download={download}
          debugMode={debugMode}
          onAnalyze={handleAnalyze}
        />
      ) : null}
      {activeTab === 'queue' ? <QueueView queue={queue} /> : null}
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
