import { defineConfig } from 'eslint/config';
import globals from "globals";
import importPlugin from "eslint-plugin-import";
import prettierPlugin from "eslint-plugin-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import sonarjs from "eslint-plugin-sonarjs";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default defineConfig([
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.sdd/**",
      "**/.cursor/**",
      "coverage/**",
      "cypress/screenshots/**",
      "cypress/videos/**",
      "**/*.{js,mjs,cjs}",
    ],
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    plugins: {
      import: importPlugin,
      prettier: prettierPlugin,
      sonarjs,
    },
    rules: {
      complexity: ["error", { max: 12, variant: "modified" }],
      "sonarjs/cognitive-complexity": ["error", 15],
      "prettier/prettier": "warn",
      "import/order": [
        "warn",
        {
          "newlines-between": "always",
          groups: [
            "type",
            "object",
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
          ],
          pathGroups: [
            {
              pattern: "react",
              group: "builtin",
              position: "before",
            },
          ],
          pathGroupsExcludedImportTypes: ["react"],
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
        },
      ],
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-undef": "off",
    },
  },
  {
    files: ["packages/renderer/**/*.{ts,tsx}"],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...reactRefresh.configs.vite.rules,
    },
  },
  {
    files: [
      "packages/main/**/*.ts",
      "packages/preload/**/*.ts",
      "cypress/**/*.{ts,tsx}",
    ],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  eslintConfigPrettier,
]);
