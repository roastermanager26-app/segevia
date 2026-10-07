import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "diseno_segevia_ai_sales_platform/**",
      "packages/shared-types/src/database.types.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
  {
    files: ["apps/worker/**/*.ts", "packages/**/*.ts"],
    languageOptions: { globals: globals.node },
  },
  {
    // Defensa en profundidad: la web nunca debe referenciar la service role key.
    files: ["apps/web/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Identifier[name=/SERVICE_ROLE/]",
          message: "La service role key nunca debe usarse en apps/web.",
        },
        {
          selector: "Literal[value=/SERVICE_ROLE/]",
          message: "La service role key nunca debe usarse en apps/web.",
        },
      ],
    },
  },
);
