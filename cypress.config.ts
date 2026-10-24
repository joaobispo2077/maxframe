import path from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'cypress';
import { defineConfig as defineViteConfig } from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  component: {
    setupNodeEvents(on) {
      on('after:run', async (results) => {
        const { writeCypressResults } = await import(
          './scripts/ci/write-cypress-results.mjs'
        );
        writeCypressResults(results);
      });
    },
    devServer: {
      framework: 'react',
      bundler: 'vite',
      viteConfig: defineViteConfig({
        plugins: [react()],
        resolve: {
          alias: {
            react: path.resolve(rootDir, 'node_modules/react'),
            'react-dom': path.resolve(rootDir, 'node_modules/react-dom'),
            // Mirror the @src alias from vitest.config.ts and packages/renderer/vite.config.ts
            // so renderer components that import domain utilities resolve correctly in Cypress.
            '@src': path.resolve(rootDir, 'src'),
          },
          dedupe: ['react', 'react-dom'],
        },
      }),
    },
    specPattern: 'cypress/component/**/*.cy.{ts,tsx}',
    supportFile: 'cypress/support/component.ts',
  },
  video: false,
});
