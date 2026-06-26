import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Root-level utility scripts (CommonJS)
    "*.js",
    // Utility scripts and scratch files (CommonJS - not part of the Next.js app)
    "scratch/**",
    "scripts/**",
    // Legacy route file
    "old_route.ts",
    // Test files
    "test_full_api.ts",
  ]),
  // Global rule overrides: disable rules that are too noisy for this codebase
  {
    rules: {
      // TypeScript: 'any' is used extensively in API routes and AI engines by design
      "@typescript-eslint/no-explicit-any": "off",
      // TypeScript: unused vars are often false positives in API handlers and generics
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],
      // prefer-const is auto-fixable and good to keep as a warning
      "prefer-const": "warn",
      // React hooks rules kept as errors (they cause real bugs)
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/purity": "error",
      "react-hooks/set-state-in-effect": "warn",
    }
  }
]);

export default eslintConfig;
