import App from '../../packages/renderer/src/App';

describe('App queue runner flow', () => {
  beforeEach(() => {
    localStorage.setItem('maxframe.lastOutputFolder', 'C:\\Batch');
    window.maxframeApi = {
      getInitialAppState: async () => ({
        appName: 'Maxframe',
        status: 'ready' as const,
        isPortable: false,
        titleBarInset: { height: 0, padLeft: 0, padRight: 0 },
      }),
      ping: async (payload: string) => payload,
      pickOutputFolder: async () => ({
        canceled: false,
        folderPath: 'C:\\Batch',
      }),
      downloadVideo: () =>
        new Promise<{ outputPath: string }>((resolve) => {
          setTimeout(
            () =>
              resolve({
                outputPath:
                  'C:\\Batch\\Never Gonna Give You Up - Rick Astley.mp4',
              }),
            1500,
          );
        }),
      subscribeDownloadProgress: (listener) => {
        const timer = window.setInterval(() => {
          listener({
            line: '[download]  45.0% of  100.00MiB at    5.00MiB/s ETA 00:10',
          });
        }, 250);
        return () => window.clearInterval(timer);
      },
      cancelDownload: async () => ({ canceled: false }),
      setDebugMode: async () => {},
      getDiagnostics: async () => ({}),
      getLogPath: async () => 'C:\\AppData\\Maxframe\\maxframe-debug.log',
      showItemInFolder: async () => {},
      analyzeVideoUrl: async () => ({
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        videoId: 'dQw4w9WgXcQ',
        title: 'Never Gonna Give You Up',
        uploader: 'Rick Astley',
        bestQuality: {
          formatId: '299',
          container: 'mp4',
          resolutionLabel: '1080p60',
          width: 1920,
          height: 1080,
          fps: 60,
          hasVideo: true,
          hasAudio: false,
        },
        qualities: [
          {
            formatId: '299',
            container: 'mp4',
            resolutionLabel: '1080p60',
            width: 1920,
            height: 1080,
            fps: 60,
            hasVideo: true,
            hasAudio: false,
          },
        ],
        audioQualities: [],
      }),
    };
  });

  it('enqueues URLs and starts queue processing', () => {
    cy.mount(<App />);
    cy.get('#unified-queue-urls').type(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    );
    cy.contains('button', 'Add to queue').click();
    cy.contains('button', 'Queue').click();
    cy.contains('button', 'Start queue').should('be.enabled').click();
    cy.contains('button', 'Stop queue', { timeout: 8000 }).should('be.visible');
    cy.contains('45%', { timeout: 8000 }).should('be.visible');
  });
});
