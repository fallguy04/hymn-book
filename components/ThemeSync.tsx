"use client";

import { useEffect } from "react";
import { useHydrated } from "@/lib/useHydrated";
import { useHymnalStore } from "@/store/useHymnalStore";

const SCALES = { s: 0.9, m: 1, l: 1.15, xl: 1.32 } as const;

/**
 * Keeps the document in step with the stored appearance settings. The inline
 * script in the layout does the first paint; this handles later changes and
 * follows the OS when the theme is left on "system".
 *
 * It waits for hydration. Before then the store reports its defaults, so this
 * used to apply "system" and medium for one frame on every launch — flashing
 * a Light-mode reader's page dark when their phone was in dark mode, and an
 * XL reader's text back to medium, right over what the head script had set.
 */
export default function ThemeSync() {
  const hydrated = useHydrated();
  const theme = useHymnalStore((s) => s.theme);
  const textSize = useHymnalStore((s) => s.textSize);

  useEffect(() => {
    if (!hydrated) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && media.matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
    };

    apply();
    if (theme !== "system") return;
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [hydrated, theme]);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.style.setProperty("--type-scale", String(SCALES[textSize]));
  }, [hydrated, textSize]);

  return null;
}
