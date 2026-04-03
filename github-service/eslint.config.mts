import js from "@eslint/js";
import effectPlugin from "@effect/eslint-plugin";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    plugins: {
      js,
      "@effect": effectPlugin,
    },
    extends: ["js/recommended"],
    languageOptions: { globals: globals.node },
    rules: {
      "@effect/no-import-from-barrel-package": "warn",
    },
  },
  tseslint.configs.recommended,
]);
