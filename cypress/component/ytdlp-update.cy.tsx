import { useEffect, useState } from 'react';

import 'cypress-axe';

import App from '../../packages/renderer/src/App';

const CURRENT = '2026.03.17';
const LATEST = '2026.08.19';
const OUTDATED = `yt-dlp is out of date. You have ${CURRENT}, and ${LATEST} is available. Old versions often stop working when YouTube changes.`;

type View = {
  version?: string;
  source: string;
  phase: string;
  current?: string;
  latest?: string;
  bundled?: string;
  manualCheckEnabled: boolean;
  showLaunchDisclosure: boolean;
  updateAllowed: boolean;
};

function view(phase: string, extras: Partial<View> = {}): View {
  return {
    version: CURRENT,
    source: 'bundled',
    phase,
    current: CURRENT,
    latest: LATEST,
    bundled: CURRENT,
    manualCheckEnabled: false,
    showLaunchDisclosure: true,
    updateAllowed: true,
    ...extras,
  };
}

function installApi(options: {
  initial: View;
  start?: () => Promise<View>;
  dismiss?: () => Promise<View>;
}) {
  return {
    getInitialAppState: async () => ({
      appName: 'Maxframe',
      status: 'ready' as const,
      isPortable: false,
      titleBarInset: { height: 0, padLeft: 0, padRight: 0 },
    }),
    ping: async (payload: string) => payload,
    analyzeVideoUrl: async () => ({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      videoId: 'dQw4w9WgXcQ',
      title: 'Test Video',
      uploader: 'Test Channel',
      qualities: [],
      audioQualities: [],
    }),
    downloadVideo: async () => ({ outputPath: '/tmp/out.mp4' }),
    subscribeDownloadProgress: () => () => {},
    cancelDownload: async () => ({ canceled: false }),
    setDebugMode: async () => {},
    getDiagnostics: async () => ({}),
    getLogPath: async () => 'C:\\AppData\\Maxframe\\maxframe-debug.log',
    getYtdlpUpdateStatus: async () => options.initial,
    subscribeYtdlpUpdate: () => () => {},
    startYtdlpUpdate:
      options.start ??
      (async () => view('success', { version: LATEST, current: LATEST })),
    dismissYtdlpUpdate: options.dismiss ?? (async () => view('idle')),
    checkYtdlpUpdate: async () => view('up-to-date', { current: CURRENT }),
  };
}

function Harness({ api }: { api: ReturnType<typeof installApi> }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    window.maxframeApi = api;
    setReady(true);
  }, [api]);
  if (!ready) {
    return null;
  }
  return <App />;
}

describe('yt-dlp update banner', () => {
  it('shows the warning, keeps buttons reachable, and passes axe', () => {
    cy.mount(<Harness api={installApi({ initial: view('outdated') })} />);
    cy.contains(OUTDATED).should('be.visible');
    cy.contains('button', 'Update yt-dlp').focus();
    cy.focused().should('contain', 'Update yt-dlp');
    cy.contains('button', 'Not now').focus();
    cy.focused().should('contain', 'Not now');
    cy.injectAxe();
    cy.checkA11y('[data-testid="ytdlp-update-banner"]');
  });

  it('shows live progress and then the success message', () => {
    let release: (next: View) => void = () => {};
    const api = installApi({
      initial: view('outdated'),
      start: () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    });
    cy.mount(<Harness api={api} />);
    cy.contains('button', 'Update yt-dlp').click();
    cy.contains('button', 'Updating yt-dlp…').should('be.visible');
    cy.get('[data-testid="ytdlp-update-live"]')
      .should('have.attr', 'aria-live', 'polite')
      .and('contain', `Updating yt-dlp to ${LATEST}.`);
    cy.then(() => {
      release(view('success', { version: LATEST, current: LATEST }));
    });
    cy.contains(`yt-dlp updated to ${LATEST}.`).should('be.visible');
    cy.injectAxe();
    cy.checkA11y('[data-testid="ytdlp-update-banner"]');
  });

  it('keeps the old binary message when the safety check fails', () => {
    cy.mount(<Harness api={installApi({ initial: view('error-checksum') })} />);
    cy.contains("didn't pass the safety check").should('be.visible');
    cy.contains(`keep downloading with ${CURRENT}`).should('be.visible');
    cy.contains('button', 'Try again').focus().click();
    cy.contains(`yt-dlp updated to ${LATEST}.`).should('be.visible');
  });

  it('hides the warning for Not now and shows the version in Settings', () => {
    let dismissed = 0;
    const api = installApi({
      initial: view('outdated'),
      dismiss: async () => {
        dismissed += 1;
        return view('idle', { version: CURRENT, source: 'bundled' });
      },
    });
    cy.mount(<Harness api={api} />);
    cy.contains('button', 'Not now').click();
    cy.contains(OUTDATED).should('not.exist');
    cy.then(() => {
      expect(dismissed).to.eq(1);
    });
    cy.contains('[role="tab"]', 'Settings').click();
    cy.get('[data-testid="ytdlp-version"]').should('contain', CURRENT);
    cy.get('[data-testid="ytdlp-version"]').should(
      'contain',
      'included with the app',
    );
    cy.get('[data-testid="ytdlp-launch-disclosure"]').should('be.visible');
    cy.injectAxe();
    cy.checkA11y('[data-testid="ytdlp-version"]');
  });

  it('shows the stored-copy fallback and updates from that button', () => {
    cy.mount(
      <Harness
        api={installApi({
          initial: view('fallback', { bundled: CURRENT }),
          start: async () =>
            view('success', { version: LATEST, current: LATEST }),
        })}
      />,
    );
    cy.contains(`the version that came with the app (${CURRENT})`).should(
      'be.visible',
    );
    cy.contains('button', 'Not now').should('not.exist');
    cy.contains('button', 'Update yt-dlp').click();
    cy.contains(`yt-dlp updated to ${LATEST}.`).should('be.visible');
  });
});
