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
    cy.mount(<App />);
    cy.get('#youtube-url').type(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    );
    cy.contains('button', 'Analyze quality').click();
    cy.contains('Video ID: dQw4w9WgXcQ').should('be.visible');
    cy.contains('Best raw quality: 1080p60 @ 60fps (mp4)').should('be.visible');
    cy.get('[aria-label="quality-results"]').should('be.visible');
  });

  it('downloads a row and shows saved path', () => {
    cy.mount(<App />);
    cy.get('#youtube-url').type(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    );
    cy.contains('button', 'Analyze quality').click();
    cy.contains('Video ID: dQw4w9WgXcQ').should('be.visible');
    cy.contains('button', 'Download').click();
    cy.contains('Saved to /tmp/mock.mp4').should('be.visible');
  });
});
