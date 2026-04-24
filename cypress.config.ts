import { defineConfig } from "cypress";
import { defineConfig as defineViteConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  component: {
    devServer: {
      framework: "react",
      bundler: "vite",
      viteConfig: defineViteConfig({
        plugins: [react()],
        resolve: {
          alias: {
            react: path.resolve(__dirname, "node_modules/react"),
            "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
          },
          dedupe: ["react", "react-dom"],
        },
      }),
    },
    specPattern: "cypress/component/**/*.cy.{ts,tsx}",
    supportFile: "cypress/support/component.ts",
  },
  video: false,
});
