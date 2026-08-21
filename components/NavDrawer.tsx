"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { Hymnal } from "@/lib/hymnals";
import BrowsePanels, { type Panel } from "./BrowsePanels";
import InstallPrompt from "./InstallPrompt";

interface NavDrawerProps {
  hymnal: Hymnal;
  isOpen: boolean;
  currentMeter: string;
  openPath?: string[];
  initialPanel?: Panel;
  onClose: () => void;
  onSelect: (number: number) => void;
}


export default function NavDrawer({
  hymnal,
  isOpen,
  currentMeter,
  openPath,
  initialPanel,
  onClose,
  onSelect,
}: NavDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  // Escape closes, and focus is trapped while the drawer owns the screen.
  useEffect(() => {
    if (!isOpen) return;
    const node = panelRef.current;
    node?.querySelector<HTMLElement>("button")?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !node) return;
      const focusable = node.querySelectorAll<HTMLElement>(
        'button, [href], input, select, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const go = (number: number) => {
    onSelect(number);
    onClose();
  };

  if (!isOpen) return null;

  /*
    Rendered conditionally rather than through AnimatePresence: with the React
    Compiler on, AnimatePresence runs the exit animation but never unmounts,
    which would leave this drawer invisible and on top of the app, eating every
    click. Mounting only while open also gives BrowsePanels its fresh initial
    state on each open.
  */
  return (
    <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduceMotion ? 0 : 0.15 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px]"
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            transition={
              reduceMotion ? { duration: 0 } : { type: "spring", damping: 32, stiffness: 320 }
            }
            drag={reduceMotion ? false : "x"}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={{ left: 0.4, right: 0 }}
            onDragEnd={(_, { offset, velocity }) => {
              if (offset.x < -80 || velocity.x < -500) onClose();
            }}
            className="fixed inset-y-0 left-0 z-50 flex w-[min(23rem,90vw)] flex-col bg-paper shadow-2xl"
          >
            {/* Mounted only while open, so the view it opens on is initial state. */}
            <BrowsePanels
              hymnal={hymnal}
              currentMeter={currentMeter}
              openPath={openPath}
              initialPanel={initialPanel}
              onClose={onClose}
              onSelect={go}
            />

        <InstallPrompt />
      </motion.div>
    </>
  );
}
