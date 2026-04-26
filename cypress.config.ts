import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'cypress';
import { defineConfig as defineViteConfig } from 'vite';

export default defineConfig({
  component: {
    devServer: {
      framework: 'react',
      bundler: 'vite',
      viteConfig: defineViteConfig({
        plugins: [react()],
        resolve: {
          alias: {
            react: path.resolve(__dirname, 'node_modules/react'),
            'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
            // Mirror the @src alias from vitest.config.ts and packages/renderer/vite.config.ts
            // so renderer components that import domain utilities resolve correctly in Cypress.
            '@src': path.resolve(__dirname, 'src'),
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
