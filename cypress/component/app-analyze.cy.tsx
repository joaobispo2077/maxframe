import App from '../../packages/renderer/src/App';

describe('App analyze flow', () => {
  beforeEach(() => {
    window.maxframeApi = {
      getInitialAppState: async () => ({
        appName: 'Maxframe',
        status: 'ready' as const,
      }),
      ping: async (payload: string) => payload,
      downloadVideo: async () => ({
        outputPath: '/tmp/mock.mp4',
      }),
      subscribeDownloadProgress: () => () => {},
      cancelDownload: async () => ({ canceled: false }),
      setDebugMode: async () => {},
      getDiagnostics: async () => ({}),
      getLogPath: async () => 'C:\\AppData\\Maxframe\\maxframe-debug.log',
      analyzeVideoUrl: async () => ({
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
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
    };
  });

  it('runs analyze and shows best quality', () => {
    const api = window.maxframeApi;
    cy.mount(<App />);
    cy.window().then((win) => {
      win.maxframeApi = api;
    });
    cy.get('#youtube-url').type('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    cy.contains('button', 'Analyze quality').click();
    cy.contains('Video ID: dQw4w9WgXcQ').should('be.visible');
    cy.contains('Best raw quality: 1080p60 @ 60fps (mp4)').should('be.visible');
    cy.get('[aria-label="quality-results"]').should('be.visible');
  });

  it('shows a downloadable quality row after analyze', () => {
    const api = window.maxframeApi;
    cy.mount(<App />);
    cy.window().then((win) => {
      win.maxframeApi = api;
    });
    cy.get('#youtube-url').type('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    cy.contains('button', 'Analyze quality').click();
    cy.contains('Video ID: dQw4w9WgXcQ').should('be.visible');
    cy.get('[aria-label="quality-results"]')
      .contains('button', /^Download$/)
      .should('be.visible')
      .and('be.enabled');
  });

  it('supports output mode selection before analyze', () => {
    window.maxframeApi.analyzeVideoUrl = async () => ({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
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
      bestAudioQuality: {
        formatId: '251',
        container: 'webm',
        resolutionLabel: 'audio',
        hasVideo: false,
        hasAudio: true,
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
      audioQualities: [
        {
          formatId: '251',
          container: 'webm',
          resolutionLabel: 'audio',
          hasVideo: false,
          hasAudio: true,
        },
      ],
    });
    const api = window.maxframeApi;

    cy.mount(<App />);
    cy.window().then((win) => {
      win.maxframeApi = api;
    });
    cy.get('#output-format').select('mp3');
    cy.get('#youtube-url').type('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    cy.contains('button', 'Analyze quality').click();
    cy.contains('Video ID: dQw4w9WgXcQ').should('be.visible');
    cy.get('#output-format').should('have.value', 'mp3');
    cy.get('[aria-label="quality-results"]').should('be.visible');
  });
});
