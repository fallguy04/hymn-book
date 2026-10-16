"use client";

import { createContext, useContext, type ReactNode } from "react";
import { motion, useDragControls, useReducedMotion, type DragControls } from "framer-motion";
import { useDialog } from "@/lib/useDialog";

/**
 * The one way anything covers the page: the keypad, word search, the menu,
 * the book chooser, the tunes sheet and the share card.
 *
 * Each of those used to carry its own backdrop (two different shades), its
 * own enter animation, its own focus trap (three different ones), its own
 * Escape handling (the menu's ran twice) and its own stacking order. Here it
 * is written once.
 *
 * Mounted conditionally by the caller, with an enter animation only. Never
 * AnimatePresence: with the React Compiler on, it ran exit animations but
 * never unmounted, leaving an invisible layer over the app that swallowed
 * every tap — two outages. An ESLint rule now forbids importing it.
 */

export type Placement = "bottom" | "left" | "center" | "fill";

interface OverlayProps {
  /** What a screen reader announces when the layer opens. */
  label: string;
  placement: Placement;
  onClose: () => void;
  /** Visual treatment of the panel; position and motion are set here. */
  className?: string;
  /** Drag down (bottom sheets) or left (the drawer) to close. Default on. */
  drag?: boolean;
  children: ReactNode;
}

const SheetContext = createContext<{ controls: DragControls | null; onClose: () => void }>({
  controls: null,
  onClose: () => {},
});

/**
 * The handle at the top of a bottom sheet. Tap to close, or drag the sheet
 * down by it. Dragging starts only here, so a finger that slides a pixel while
 * pressing a key on the keypad never turns a keypress into a drag.
 *
 * It sits on its own row, with room around it: crowded against a button it
 * read as part of that button.
 */
export function SheetGrip({ label = "Close" }: { label?: string }) {
  const { controls, onClose } = useContext(SheetContext);
  return (
    <button
      type="button"
      onClick={onClose}
      onPointerDown={(e) => controls?.start(e)}
      aria-label={label}
      className="flex h-8 w-full shrink-0 touch-none items-center justify-center"
    >
      <span aria-hidden className="block h-1.5 w-11 rounded-full bg-paper-rule" />
    </button>
  );
}

const WRAPPER: Record<Placement, string> = {
  bottom: "fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-[30rem] flex-col lg:bottom-6",
  left: "fixed inset-y-0 left-0 z-50 flex w-[min(23rem,88vw)] flex-col",
  center: "pointer-events-none fixed inset-0 z-50 grid place-items-center p-5",
  fill:
    "pointer-events-none fixed inset-0 z-50 flex flex-col px-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-[calc(env(safe-area-inset-bottom)+0.75rem)] lg:items-center lg:pt-[12vh]",
};

const PANEL: Record<Placement, string> = {
  bottom:
    "rounded-t-3xl border-t border-paper-rule bg-paper shadow-[0_-12px_40px_-16px_rgba(0,0,0,0.3)] lg:rounded-3xl lg:border lg:shadow-2xl",
  left: "h-full bg-paper shadow-2xl",
  center: "pointer-events-auto rounded-3xl border border-paper-rule bg-paper shadow-2xl",
  fill: "pointer-events-auto rounded-3xl border border-paper-rule bg-paper shadow-2xl",
};

export default function Overlay({
  label,
  placement,
  onClose,
  className = "",
  drag = true,
  children,
}: OverlayProps) {
  const reduceMotion = useReducedMotion();
  const panel = useDialog<HTMLDivElement>();
  const controls = useDragControls();
  const canDrag = drag && !reduceMotion && (placement === "bottom" || placement === "left");

  const enter =
    placement === "bottom"
      ? { initial: { y: 40, opacity: 0 }, animate: { y: 0, opacity: 1 } }
      : placement === "left"
        ? { initial: { x: "-100%" }, animate: { x: 0 } }
        : { initial: { y: 12, opacity: 0, scale: 0.98 }, animate: { y: 0, opacity: 1, scale: 1 } };

  const transition = reduceMotion
    ? { duration: 0 }
    : placement === "left"
      ? { type: "spring" as const, damping: 32, stiffness: 320 }
      : { duration: 0.2, ease: "easeOut" as const };

  // Bottom sheets and the drawer keep their content clear of the iPhone's
  // home indicator and notch. They used to ignore the safe area, putting the
  // keypad's bottom row and the menu's last link under the home bar.
  const insets =
    placement === "bottom"
      ? { paddingBottom: "env(safe-area-inset-bottom)" }
      : placement === "left"
        ? {
            paddingTop: "env(safe-area-inset-top)",
            paddingBottom: "env(safe-area-inset-bottom)",
            paddingLeft: "env(safe-area-inset-left)",
          }
        : undefined;

  const panelProps = {
    ref: panel,
    role: "dialog" as const,
    "aria-modal": true as const,
    "aria-label": label,
    tabIndex: -1,
    initial: reduceMotion ? { opacity: 0 } : enter.initial,
    animate: reduceMotion ? { opacity: 1 } : enter.animate,
    transition,
    style: insets,
  };

  const dragProps =
    canDrag && placement === "bottom"
      ? {
          drag: "y" as const,
          dragListener: false,
          dragControls: controls,
          dragConstraints: { top: 0, bottom: 0 },
          dragElastic: { top: 0, bottom: 0.5 },
          onDragEnd: (_: unknown, info: { offset: { y: number }; velocity: { y: number } }) => {
            if (info.offset.y > 90 || info.velocity.y > 600) onClose();
          },
        }
      : canDrag && placement === "left"
        ? {
            drag: "x" as const,
            dragDirectionLock: true,
            dragConstraints: { left: 0, right: 0 },
            dragElastic: { left: 0.4, right: 0 },
            onDragEnd: (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
              if (info.offset.x < -80 || info.velocity.x < -500) onClose();
            },
          }
        : {};

  return (
    <SheetContext.Provider value={{ controls: canDrag ? controls : null, onClose }}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.15 }}
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px]"
      />

      {placement === "bottom" || placement === "left" ? (
        <motion.div
          {...panelProps}
          {...dragProps}
          className={`${WRAPPER[placement]} ${PANEL[placement]} ${className}`}
        >
          {children}
        </motion.div>
      ) : (
        <div className={WRAPPER[placement]}>
          <motion.div {...panelProps} className={`${PANEL[placement]} ${className}`}>
            {children}
          </motion.div>
        </div>
      )}
    </SheetContext.Provider>
  );
}
