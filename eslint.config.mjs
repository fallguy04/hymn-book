import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Twice now AnimatePresence has taken the app down: with the React
      // Compiler on it plays the exit animation and never unmounts, leaving
      // an invisible layer over the page that swallows every tap. Layers are
      // mounted conditionally with an enter animation only (components/ui/Overlay).
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "framer-motion",
              importNames: ["AnimatePresence"],
              message:
                "AnimatePresence never unmounts under the React Compiler. Mount conditionally with an enter animation (see components/ui/Overlay.tsx).",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([
    ".claude/**",
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
