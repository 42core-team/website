import path from "node:path";
import { fileURLToPath } from "node:url";
import antfu from "@antfu/eslint-config";
import tailwind from "eslint-plugin-tailwindcss";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const tailwindEntry = path.join(configDir, "styles", "globals.css");

export default antfu({
  type: "app",
  nextjs: true,
  formatters: true,
  typescript: true,
  stylistic: {
    indent: 2,
    semi: true,
    quotes: "double",
  },
  ignores: [".pnpm-store/**", "helm/**"],
}, {
  rules: {
    "no-console": "warn",
    "no-debugger": "warn",
    "node/prefer-global/process": "off",
    "no-alert": "warn",
  },
}, ...tailwind.configs["flat/recommended"], {
  settings: {
    tailwindcss: {
      config: tailwindEntry,
    },
  },
  rules: {
    "tailwindcss/classnames-order": "warn",
    "tailwindcss/no-custom-classname": "off",
  },
});
