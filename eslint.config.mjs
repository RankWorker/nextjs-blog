import js from "@eslint/js";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import { fileURLToPath } from "node:url";
import path from "node:path";
import tseslint from "typescript-eslint";

const configDirectory = path.dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "node_modules/**",
      "examples/**/.next/**",
      "examples/**/out/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/scripts/**/*.mjs", "**/*.config.mjs"],
    languageOptions: { globals: { process: "readonly", URL: "readonly" } },
  },
  ...[
    ...tseslint.configs.strictTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
  ].map((config) => ({ ...config, files: ["**/*.{ts,tsx}"] })),
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: configDirectory,
      },
    },
    plugins: {
      "jsx-a11y": jsxA11y,
      "react-hooks": reactHooks,
    },
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      ...reactHooks.configs.flat.recommended.rules,
      "@typescript-eslint/consistent-type-exports": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-import-type-side-effects": "error",
      "@typescript-eslint/no-unnecessary-condition": "error",
      "@typescript-eslint/no-deprecated": "error",
      "@typescript-eslint/consistent-type-definitions": "off",
      "@typescript-eslint/prefer-nullish-coalescing": "off",
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        { allowNumber: true },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["tests/**/*.{ts,tsx}", "*.config.{ts,mjs}"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-deprecated": "off",
      "@typescript-eslint/unbound-method": "off",
      "jsx-a11y/alt-text": "off",
    },
  },
);
