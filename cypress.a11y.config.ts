import 'axe-core';

import { defineConfig } from 'cypress';

// Headless scan of the built renderer. Electron is not the page axe drives.
// `npm run build:a11y -w @maxframe/renderer` then `vite preview` on this URL.
// Reduced motion keeps axe on the settled colors. The reveal animation
// otherwise changes contrast while it is still running.
export default defineConfig({
  video: false,
  defaultCommandTimeout: 10000,
  pageLoadTimeout: 60000,
  e2e: {
    baseUrl: 'http://127.0.0.1:4173',
    specPattern: 'cypress/e2e/accessibility.cy.ts',
    supportFile: 'cypress/support/a11y.ts',
    screenshotOnRunFailure: true,
    setupNodeEvents(on) {
      on('before:browser:launch', (browser, launchOptions) => {
        if (browser.family === 'chromium' && launchOptions.args) {
          launchOptions.args.push('--force-prefers-reduced-motion');
        }
        return launchOptions;
      });
    },
  },
});
