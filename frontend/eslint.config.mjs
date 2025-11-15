import antfu from "@antfu/eslint-config";

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
});
