import App from '../../packages/renderer/src/App';

const BLOCKED =
  "YouTube blocked this download. This often happens when the app's yt-dlp is out of date. Try again in a few minutes.";

const YTDLP_LOG =
  'ERROR: [youtube] dQw4w9WgXcQ: Unable to download API page: HTTP Error 403: Forbidden';

const IPC_403 = `Error invoking remote method 'app:download-video': Error: ${YTDLP_LOG}`;

const PLAYLIST_URL =
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=RDdQw4w9WgXcQ';

describe('App download error', () => {
  it('shows the short 403 message once, without the IPC prefix or the yt-dlp log', () => {
    let downloads = 0;
    const api = {
      getInitialAppState: async () => ({
        appName: 'Maxframe',
        status: 'ready' as const,
        isPortable: false,
        titleBarInset: { height: 0, padLeft: 0, padRight: 0 },
      }),
      ping: async (payload: string) => payload,
      downloadVideo: async () => {
        downloads += 1;
        if (downloads === 1) {
          throw new Error(IPC_403);
        }
        return { outputPath: 'C:\\Users\\Joao\\Videos\\out.mp4' };
      },
      subscribeDownloadProgress: () => () => {},
      cancelDownload: async () => ({ canceled: false }),
      setDebugMode: async () => {},
      getDiagnostics: async () => ({
        ytdlpPath: 'C:\\Users\\Joao\\AppData\\yt-dlp.exe',
        ytdlpFound: true,
        ffmpegPath: 'C:/Users/Joao/ffmpeg.exe',
        ffmpegFound: true,
        platform: 'win32',
        arch: 'x64',
        appVersion: '1.8.1',
        pathEnv: 'C:\\Users\\Joao\\bin;C:\\Windows\\system32',
        lastError: YTDLP_LOG,
        lastErrorDetail: YTDLP_LOG,
        lastSubmittedUrl: PLAYLIST_URL,
        ytdlpVersion: '2026.08.19',
      }),
      getLogPath: async () => 'C:\\AppData\\Maxframe\\maxframe-debug.log',
      analyzeVideoUrl: async () => ({
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        videoId: 'dQw4w9WgXcQ',
        title: 'Test Video',
        uploader: 'Test Channel',
        bestQuality: {
          formatId: '137',
          container: 'mp4',
          resolutionLabel: '1080p',
          width: 1920,
          height: 1080,
          fps: 30,
          hasVideo: true,
          hasAudio: false,
        },
        qualities: [
          {
            formatId: '137',
            container: 'mp4',
            resolutionLabel: '1080p',
            width: 1920,
            height: 1080,
            fps: 30,
            hasVideo: true,
            hasAudio: false,
          },
        ],
        audioQualities: [],
      }),
    };

    cy.mount(<App />);
    cy.window().then((win) => {
      win.maxframeApi = api;
    });

    cy.get('#unified-queue-urls').type(PLAYLIST_URL);
    cy.get('[data-testid="playlist-notice"]')
      .should('be.visible')
      .and('have.attr', 'role', 'status')
      .and('contain', 'Playlist link. Only this video will be downloaded.');
    cy.contains('button', 'Check quality').click();
    cy.contains('Video ID: dQw4w9WgXcQ').should('be.visible');
    cy.get('[aria-label="quality-results"]')
      .contains('button', /^Download$/)
      .click();

    cy.get('[role="alert"]')
      .should('have.length', 1)
      .and('contain', BLOCKED)
      .and('not.contain', 'Error invoking remote method')
      .and('not.contain', 'HTTP Error 403')
      .and('not.contain', 'ERROR:');
    cy.contains('button', 'Try again').should('be.visible');
    cy.get('body').should('not.contain', 'Update yt-dlp');
    cy.contains(YTDLP_LOG).should('be.visible');
    cy.contains(
      'Platform: win32 (x64) · App: 1.8.1 · yt-dlp: 2026.08.19',
    ).should('be.visible');
    cy.contains('C:\\Users\\<user>\\AppData\\yt-dlp.exe').should('be.visible');
    cy.get('body').should('not.contain', 'Joao');
    cy.contains(
      'Your Windows user name and PATH are left out of this report.',
    ).should('be.visible');
    cy.get('body').should('not.contain', 'Error invoking remote method');
    cy.get('body').then(($body) => {
      const count = $body.text().split(BLOCKED).length - 1;
      expect(count).to.eq(1);
    });

    cy.contains('button', 'Try again').click();
    cy.contains('Saved to').should('be.visible');
    cy.then(() => {
      expect(downloads).to.eq(2);
    });
  });

  it('shows the generic message for an unrecognized IPC error', () => {
    const raw = 'ERROR: [youtube] boom: unable to extract player response';
    cy.mount(<App />);
    cy.window().then((win) => {
      win.maxframeApi = {
        getInitialAppState: async () => ({
          appName: 'Maxframe',
          status: 'ready' as const,
          isPortable: false,
          titleBarInset: { height: 0, padLeft: 0, padRight: 0 },
        }),
        ping: async (payload: string) => payload,
        downloadVideo: async () => {
          throw new Error(
            `Error invoking remote method 'app:download-video': Error: ${raw}`,
          );
        },
        subscribeDownloadProgress: () => () => {},
        cancelDownload: async () => ({ canceled: false }),
        setDebugMode: async () => {},
        getDiagnostics: async () => ({
          ytdlpPath: 'yt-dlp',
          ytdlpFound: true,
          ffmpegPath: 'ffmpeg',
          ffmpegFound: true,
          platform: 'linux',
          arch: 'x64',
          appVersion: '1.8.1',
          pathEnv: '/usr/bin',
          lastError: raw,
          lastErrorDetail: raw,
          lastSubmittedUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          ytdlpVersion: '2026.08.19',
        }),
        getLogPath: async () => '/tmp/maxframe-debug.log',
        analyzeVideoUrl: async () => ({
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          videoId: 'dQw4w9WgXcQ',
          title: 'Test Video',
          uploader: 'Test Channel',
          bestQuality: {
            formatId: '137',
            container: 'mp4',
            resolutionLabel: '1080p',
            width: 1920,
            height: 1080,
            fps: 30,
            hasVideo: true,
            hasAudio: false,
          },
          qualities: [
            {
              formatId: '137',
              container: 'mp4',
              resolutionLabel: '1080p',
              width: 1920,
              height: 1080,
              fps: 30,
              hasVideo: true,
              hasAudio: false,
            },
          ],
          audioQualities: [],
        }),
      };
    });

    cy.get('#unified-queue-urls').type(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    );
    cy.contains('button', 'Check quality').click();
    cy.get('[aria-label="quality-results"]')
      .contains('button', /^Download$/)
      .click();
    cy.get('[role="alert"]')
      .should('contain', "Couldn't finish this download.")
      .and('not.contain', 'Error invoking remote method')
      .and('not.contain', 'unable to extract');
    cy.contains('button', 'Try again').should('be.visible');
    cy.contains('button', 'Copy report').should('be.visible');
    cy.contains(raw).should('be.visible');
  });

  it('does not show a banner when the IPC error is Download canceled.', () => {
    cy.mount(<App />);
    cy.window().then((win) => {
      win.maxframeApi = {
        getInitialAppState: async () => ({
          appName: 'Maxframe',
          status: 'ready' as const,
          isPortable: false,
          titleBarInset: { height: 0, padLeft: 0, padRight: 0 },
        }),
        ping: async (payload: string) => payload,
        downloadVideo: async () => {
          throw new Error(
            "Error invoking remote method 'app:download-video': Error: Download canceled.",
          );
        },
        subscribeDownloadProgress: () => () => {},
        cancelDownload: async () => ({ canceled: true }),
        setDebugMode: async () => {},
        getDiagnostics: async () => {
          throw new Error('diagnostics should not be fetched');
        },
        getLogPath: async () => '/tmp/maxframe-debug.log',
        analyzeVideoUrl: async () => ({
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          videoId: 'dQw4w9WgXcQ',
          title: 'Test Video',
          uploader: 'Test Channel',
          bestQuality: {
            formatId: '137',
            container: 'mp4',
            resolutionLabel: '1080p',
            width: 1920,
            height: 1080,
            fps: 30,
            hasVideo: true,
            hasAudio: false,
          },
          qualities: [
            {
              formatId: '137',
              container: 'mp4',
              resolutionLabel: '1080p',
              width: 1920,
              height: 1080,
              fps: 30,
              hasVideo: true,
              hasAudio: false,
            },
          ],
          audioQualities: [],
        }),
      };
    });

    cy.get('#unified-queue-urls').type(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    );
    cy.contains('button', 'Check quality').click();
    cy.get('[aria-label="quality-results"]')
      .contains('button', /^Download$/)
      .click();
    cy.contains('Video ID: dQw4w9WgXcQ').should('be.visible');
    cy.get('[role="alert"]').should('not.exist');
    cy.contains('Error invoking remote method').should('not.exist');
    cy.contains('Download canceled.').should('not.exist');
  });
});
