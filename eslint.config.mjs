import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Modules that hold secrets or answer keys. Anything bundled for the browser
// must reach them through an API route, never by import.
const serverOnly = [
  "@/lib/server/*",
  "**/lib/server/**",
  "**/learning/rules",
  "**/learning/actions",
  "**/prime/server",
  "**/prime/grading",
  "**/prime/questions/*",
];

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  { rules: { "react-hooks/set-state-in-effect": "off" } },
  {
    files: [
      "src/components/**",
      "src/app/**/*.tsx",
      "src/lib/**/provider.tsx",
      "src/lib/voice/**",
      "src/lib/email-summary/**",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: serverOnly,
              message:
                "Server-only module (secrets or answer keys). Call an API route instead.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    ".cortana/**",
    "next-env.d.ts",
    "vendor/**",
    "test-results/**",
    "playwright-report/**",
  ]),
]);
