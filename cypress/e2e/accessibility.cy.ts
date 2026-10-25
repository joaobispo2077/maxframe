type AxeNode = { impact?: string | null };

type AxeRule = {
  id: string;
  impact?: string | null;
  nodes?: AxeNode[];
};

type AxeResults = {
  violations: AxeRule[];
  incomplete?: unknown[];
};

type AxeWindow = Window & {
  axe: {
    run: (
      context: Document,
      options?: { resultTypes?: string[] },
    ) => Promise<AxeResults>;
  };
};

type Scan = {
  screen: string;
  violations: AxeRule[];
  incomplete: unknown[];
};

const SAMPLE_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

function installApi(win: Window) {
  win.maxframeApi = {
    getInitialAppState: async () => ({
      appName: 'Maxframe',
      status: 'ready',
      isPortable: false,
      titleBarInset: { height: 0, padLeft: 0, padRight: 0 },
    }),
    ping: async (payload: string) => payload,
    analyzeVideoUrl: async () => ({
      url: SAMPLE_URL,
      videoId: 'dQw4w9WgXcQ',
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
    }),
    downloadVideo: async () => ({ outputPath: '/tmp/mock.mp4' }),
    subscribeDownloadProgress: () => () => {},
    cancelDownload: async () => ({ canceled: false }),
    setDebugMode: async () => {},
    getDiagnostics: async () => ({}),
    getLogPath: async () => 'C:\\AppData\\Maxframe\\maxframe-debug.log',
  };
}

function scan(screen: string, bucket: Scan[]) {
  // The results panel reveals over 300ms. Scan the settled frame.
  cy.wait(500);
  cy.injectAxe();
  cy.window({ log: false }).then((win) => {
    const axeWindow = win as AxeWindow;
    return axeWindow.axe
      .run(win.document, { resultTypes: ['violations', 'incomplete'] })
      .then((results) => {
        bucket.push({
          screen,
          violations: results.violations,
          incomplete: results.incomplete ?? [],
        });
      });
  });
}

describe('renderer accessibility', () => {
  it('records axe results for the built renderer screens', () => {
    const bucket: Scan[] = [];
    cy.visit('/', { onBeforeLoad: installApi });
    cy.contains('button', 'Check quality').should('be.visible');
    scan('analyze', bucket);

    cy.get('#unified-queue-urls').type(SAMPLE_URL);
    cy.contains('button', 'Check quality').click();
    cy.contains('Video ID: dQw4w9WgXcQ').should('be.visible');
    scan('analyze-results', bucket);

    cy.contains('[role="tab"]', 'Queue').click();
    cy.contains('h2, h3, [role="heading"]', 'Download queue').should(
      'be.visible',
    );
    scan('queue', bucket);

    cy.contains('[role="tab"]', 'Settings').click();
    cy.contains('h2, h3, [role="heading"]', 'Settings').should('be.visible');
    scan('settings', bucket);

    cy.then(() => {
      cy.writeFile('reports/quality/axe-raw.json', { scans: bucket });
    });
  });
});
