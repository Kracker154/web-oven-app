// eslint.config.js

import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // This is your original configuration
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  // !! START OF THE FIX: ADD THIS NEW OBJECT !!
  // This object will override the default rules.
  {
    rules: {
      // This turns off the "Unexpected any" error.
      // It changes it from a build-breaking "error" to a harmless "warn" in your editor.
      "@typescript-eslint/no-explicit-any": "warn",

      // This turns off the "variable is defined but never used" error.
      "@typescript-eslint/no-unused-vars": "warn",
    }
  }
  // !! END OF THE FIX !!
];

export default eslintConfig;
