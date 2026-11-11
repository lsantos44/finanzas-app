import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

// Errores = fallos reales (variables sin definir, hooks mal usados, claves duplicadas…).
// Avisos = limpieza (variables sin usar, dependencias de hooks), que no bloquean.
export default [
  { ignores: ["dist/**", "node_modules/**"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2023, sourceType: "module",
      globals: { ...globals.browser, ...globals.worker, __BUILD__: "readonly" },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react, "react-hooks": reactHooks },
    settings: { react: { version: "18.3" } },
    rules: {
      "react/jsx-uses-vars": "error", "react/jsx-uses-react": "off",
      "react/jsx-key": "error", "react/jsx-no-undef": "error", "react/no-danger": "error",
      "react/jsx-no-target-blank": "error",
      "react-hooks/rules-of-hooks": "error", "react-hooks/exhaustive-deps": "warn",
      "no-unused-vars": ["warn", { args: "none", caughtErrors: "none", varsIgnorePattern: "^_" }],
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  { files: ["test/**", "*.config.js"], languageOptions: { globals: { ...globals.node } } },
];
