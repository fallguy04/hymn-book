"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Delete, Search, ArrowRight } from "lucide-react";
import { type Hymn, type Hymnal, getHymn, hymnTitle, reachableDigits } from "@/lib/hymnals";

interface SmartNumpadProps {
  hymnal: Hymnal;
  buffer: string;
  recents: number[];
  onKeyPress: (key: string) => void;
  onDelete: () => void;
  onGo: () => void;
  onSelect: (number: number) => void;
  onSwitchToText: () => void;
  onClose: () => void;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

/** A light tick on each press; silently absent where unsupported. */
const tick = () => navigator.vibrate?.(8);

export default function SmartNumpad({
  hymnal,
  buffer,
  recents,
  onKeyPress,
  onDelete,
  onGo,
  onSelect,
  onSwitchToText,
  onClose,
}: SmartNumpadProps) {
  const reduceMotion = useReducedMotion();
  const target: Hymn | undefined = buffer ? getHymn(hymnal, Number(buffer)) : undefined;
  const reachable = reachableDigits(hymnal, buffer);

  const press = (key: string) => {
    tick();
    onKeyPress(key);
  };

  const keyClass = (key: string) => {
    const dead = buffer.length >= 3 || !reachable.has(key);
    return `h-14 rounded-2xl font-serif text-2xl transition-all active:scale-95 ${
      dead
        ? "bg-paper-sunken/50 text-paper-faint/40"
        : "bg-paper-sunken text-paper-ink hover:bg-paper-rule"
    }`;
  };

  return (
    <motion.div
      initial={reduceMotion ? false : { y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={reduceMotion ? undefined : { y: 24, opacity: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="rounded-t-3xl border-t border-paper-rule bg-paper px-5 pb-8 pt-3 shadow-[0_-12px_40px_-16px_rgba(0,0,0,0.25)]"
    >
      <button
        onClick={onClose}
        aria-label="Close keypad"
        className="mx-auto mb-3 block h-1 w-10 rounded-full bg-paper-rule"
      />

      {/* Live preview: you see which hymn you're heading to before committing,
          which is what the old floating "ticket" was reaching for. */}
      <div className="mb-3 flex h-14 items-center gap-3 px-1">
        {buffer ? (
          <>
            <span className="font-serif text-3xl tabular-nums text-paper-ink">{buffer}</span>
            {target ? (
              <button
                onClick={onGo}
                className="flex flex-1 items-center justify-between gap-2 rounded-xl bg-paper-sunken px-3 py-2 text-left transition-colors hover:bg-paper-rule"
              >
                <span className="line-clamp-2 font-serif text-[0.95rem] leading-snug text-paper-ink">
                  {hymnTitle(target)}
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-paper-muted" />
              </button>
            ) : (
              <span className="font-serif italic text-paper-faint">No hymn {buffer}</span>
            )}
          </>
        ) : recents.length > 0 ? (
          <div className="flex w-full gap-2 overflow-x-auto no-scrollbar">
            <span className="text-label shrink-0 self-center">Recent</span>
            {recents.map((n) => (
              <button
                key={n}
                onClick={() => onSelect(n)}
                className="shrink-0 rounded-full bg-paper-sunken px-3 py-1.5 font-serif text-sm tabular-nums text-paper-ink transition-colors hover:bg-paper-rule"
              >
                {n}
              </button>
            ))}
          </div>
        ) : (
          <span className="font-serif italic text-paper-faint">Enter a hymn number</span>
        )}
      </div>

      <div className="mx-auto grid max-w-sm grid-cols-3 gap-2.5">
        {KEYS.map((key) => (
          <button key={key} onClick={() => press(key)} className={keyClass(key)}>
            {key}
          </button>
        ))}

        <button
          onClick={onSwitchToText}
          aria-label="Search by words"
          className="flex h-14 items-center justify-center rounded-2xl bg-paper-sunken text-paper-muted transition-colors hover:bg-paper-rule active:scale-95"
        >
          <Search className="h-5 w-5" />
        </button>

        <button onClick={() => press("0")} className={keyClass("0")}>
          0
        </button>

        <button
          onClick={() => {
            tick();
            onDelete();
          }}
          aria-label="Delete"
          disabled={!buffer}
          className="flex h-14 items-center justify-center rounded-2xl bg-paper-sunken text-paper-muted transition-colors hover:bg-paper-rule active:scale-95 disabled:opacity-30"
        >
          <Delete className="h-5 w-5" />
        </button>
      </div>
    </motion.div>
  );
}
