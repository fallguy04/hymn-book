"use client";

import { motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import TuneList from "./TuneList";

interface TuneSheetProps {
  meter: string;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Tapping a hymn's meter should answer one question straight away — what do we
 * sing this to? — so it opens here rather than sending you into the drawer to
 * find the right tab. Same store as the drawer's master list, so a tune added
 * from either place shows up in both.
 */
export default function TuneSheet({ meter, isOpen, onClose }: TuneSheetProps) {
  const reduceMotion = useReducedMotion();

  if (!isOpen) return null;

  /* Conditional rather than AnimatePresence — see the note in NavDrawer: with
     the React Compiler on it never unmounts, stranding an invisible sheet over
     the app. */
  return (
    <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduceMotion ? 0 : 0.15 }}
            onClick={onClose}
            className="fixed inset-0 z-[55] bg-black/25 backdrop-blur-[2px]"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`Tunes for ${meter}`}
            initial={reduceMotion ? { opacity: 0 } : { y: "100%" }}
            animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
            transition={
              reduceMotion ? { duration: 0 } : { type: "spring", damping: 32, stiffness: 320 }
            }
            drag={reduceMotion ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, { offset, velocity }) => {
              if (offset.y > 120 || velocity.y > 600) onClose();
            }}
            className="fixed inset-x-0 bottom-0 z-[60] mx-auto flex max-h-[70dvh] w-full max-w-[34rem] flex-col rounded-t-3xl border-t border-paper-rule bg-paper shadow-2xl"
          >
            <div className="shrink-0 px-4 pb-2 pt-3">
              <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-paper-rule" />
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-label">Tunes for this meter</p>
                  <h2 className="font-serif text-2xl leading-tight text-paper-ink">{meter}</h2>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="rounded-full p-2 text-paper-muted transition-colors hover:bg-paper-sunken"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

        <TuneList meter={meter} addTo={meter} />
      </motion.div>
    </>
  );
}
