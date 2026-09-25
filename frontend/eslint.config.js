import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "components.json"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": "warn",
      // The codebase intentionally uses `any` casts at API boundaries;
      // tsc strict mode covers genuine type safety.
      "@typescript-eslint/no-explicit-any": "off",
      // Several dialogs/pages load server data into local form state inside
      // effects (fetch → setState). That pattern is flagged by the new
      // react-hooks v7 rule but is intentional here; kept as a warning so it
      // stays visible without failing the build.
      "react-hooks/set-state-in-effect": "warn",
    },
  }
);
