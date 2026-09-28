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
      // API responses are cast to shared types (`res.data as Product[]`) at the
      // query boundary; tsc strict mode covers the rest of type safety.
      "@typescript-eslint/no-explicit-any": "off",
      // Form fields hydrate from fetched server data inside effects
      // (query data → setState per field). The react-hooks v7 rule flags that
      // pattern; kept as a warning so it stays visible without failing the build.
      "react-hooks/set-state-in-effect": "warn",
    },
  }
);
