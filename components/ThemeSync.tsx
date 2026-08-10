"use client";

import { useEffect } from "react";
import { useHymnalStore } from "@/store/useHymnalStore";

const SCALES = { s: 0.9, m: 1, l: 1.15, xl: 1.32 } as const;

/**
 * Keeps the document in step with the stored appearance settings. The inline
 * script in the layout does the first paint; this handles later changes and
 * follows the OS when the theme is left on "system".
 */
export default function ThemeSync() {
  const theme = useHymnalStore((s) => s.theme);
  const textSize = useHymnalStore((s) => s.textSize);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && media.matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
    };

    apply();
    if (theme !== "system") return;
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty("--type-scale", String(SCALES[textSize]));
  }, [textSize]);

  return null;
}
