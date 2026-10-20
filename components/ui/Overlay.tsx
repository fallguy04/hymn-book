"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { useDialog } from "@/lib/useDialog";
import { LayerMotion } from "@/lib/layers";
import { AWAY, RISE, easeIn, easeOut, prefersReducedMotion, spring, tween } from "@/lib/spring";

/**
 * The one way anything covers the page: the keypad, word search, the menu,
 * the book chooser, the tunes sheet and the share card.
 *
 * Each of those used to carry its own backdrop (two different shades), its
 * own enter animation, its own focus trap (three different ones), its own
 * Escape handling (the menu's ran twice) and its own stacking order. Here it
 * is written once.
 *
 * A sheet is a physical thing. It rises on a spring and lands. A finger
 * anywhere on it (but in a list that scrolls) drags it down one-to-one, and
 * upward it only gives as a rubber band. Let go, and it either carries the
 * finger's speed off the screen (past a third of its height, or flicked) or
 * springs back with it. The page behind dims exactly as far as the sheet is
 * open. A tap above it, Back, Escape or choosing something sends it away the
 * same way. The tap that ends a drag never presses a key.
 *
 * The menu drawer is the same thing on the other axis. The share card and
 * word search don't drag; they rise a little and fade, and fade out.
 *
 * How it leaves. The layer is still mounted when it is asked to close
 * (`leaving`, from lib/layers); this animates it out from wherever it is,
 * keeping a drag's speed, then reports `gone()` so the caller can unmount it.
 * Never AnimatePresence: with the React Compiler on, it ran exit animations
 * but never unmounted, leaving an invisible layer over the app that swallowed
 * every tap — two outages. An ESLint rule now forbids importing it. Here the
 * unmount does not depend on an animation library: it follows our own
 * animation's end, with a timer behind it for a frame loop that has stopped
 * (a backgrounded tab).
 *
 * While it moves, transform and opacity are written straight to the DOM, not
 * through React state, so a drag costs no renders.
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

const SheetContext = createContext<{ onClose: () => void }>({ onClose: () => {} });

/**
 * The handle at the top of a bottom sheet. Tap to close. (The whole sheet
 * drags now, so this is a hint and a target; with a mouse, where only the
 * handle drags, it is the way to pull the sheet down.)
 *
 * It sits on its own row, with room around it: crowded against a button it
 * read as part of that button.
 */
export function SheetGrip({ label = "Close" }: { label?: string }) {
  const { onClose } = useContext(SheetContext);
  return (
    <button
      type="button"
      onClick={onClose}
      data-sheet-grip=""
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

// ---------------------------------------------------------------------------
// Motion
// ---------------------------------------------------------------------------

/** How far past its own edge a sheet starts and ends, clear of shadows and `lg:bottom-6`. */
const PAD = 24;
/** Where the leaving spring aims: further than it needs to go, so it is still moving as it exits. */
const AIM = 60;
/** Movement before a touch becomes a drag; below it, it is still a tap. */
const THRESHOLD = 10;
/** Past this fraction of its size, letting go sends it away. */
const FRACTION = 0.32;
/** Or faster than this (px/s) toward closed. */
const FLICK = 900;
/** Velocity is read from the last this-many milliseconds of the finger. */
const WINDOW = 110;
/** If the frame loop never finishes a leave, take the layer away anyway after this long. */
const SAFETY = 900;
/** The same for arriving: if frames never came, show the sheet where it belongs. */
const ARRIVAL_SAFETY = 1500;
/** Reduced motion: a quick fade, in and out. */
const FADE_MS = 150;
/** The share card and search leave this quickly. */
const LEAVE_MS = 170;
/** How far the share card and search rise as they arrive. */
const RISE_PX = 14;

/** Pulling past fully open: it gives, a little less each pixel, and never more than 140. */
const band = (d: number) => 140 * (1 - 1 / (d / 140 + 1));
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Lists that scroll, which a finger on must scroll rather than drag the sheet. */
const SCROLLERS = ".overflow-y-auto, .overflow-y-scroll, .overflow-auto, .overflow-scroll";

function scrolls(el: HTMLElement, axis: "x" | "y"): boolean {
  const style = getComputedStyle(el);
  const overflow = axis === "y" ? style.overflowY : style.overflowX;
  if (overflow !== "auto" && overflow !== "scroll") return false;
  return axis === "y" ? el.scrollHeight > el.clientHeight + 1 : el.scrollWidth > el.clientWidth + 1;
}

/**
 * slide: a bottom sheet or the drawer. `value` is how far it has gone toward
 * closed, in px: 0 open, its own size (and a little) gone, negative when
 * pulled past open.
 * rise: the share card and search. `value` is how open it is, 0 to 1.
 * flat: reduced motion. As rise, but only opacity changes.
 */
type Kind = "slide" | "rise" | "flat";
type Phase = "enter" | "idle" | "drag" | "leave";

interface Sample {
  t: number;
  c: number;
}

interface Drag {
  id: number;
  x: number;
  y: number;
  started: boolean;
  dead: boolean;
  /** Where the finger touched down, along the axis. */
  start: number;
  /**
   * The ten pixels it moved before this was a drag, toward closed (signed).
   * They are taken off, so the sheet picks up under the finger without a
   * jump, but nothing past them is lost: a flick that begins with a long
   * first movement still carries all of it.
   */
  lead: number;
  /** Where the sheet was when the drag began. */
  base: number;
  samples: Sample[];
}

interface Latest {
  onClose: () => void;
  gone: () => void;
  drag: boolean;
}

/**
 * Everything that moves a panel. Plain objects and DOM writes, no React: it is
 * created in a layout effect, driven by pointer events and animation frames,
 * and told to leave by the layer's `leaving` flag.
 */
class PanelMotion {
  private readonly kind: Kind;
  private readonly axis: "x" | "y";
  private value = 0;
  private speed = 0;
  private extent = 1;
  private phase: Phase = "enter";
  private stop: (() => void) | null = null;
  private safety = 0;
  private arrival = 0;
  private scrollSync = 0;
  private finished = false;
  private drag: Drag | null = null;
  private swallowUntil = 0;
  private mutations: MutationObserver | null = null;
  private resizes: ResizeObserver | null = null;

  constructor(
    private readonly panel: HTMLElement,
    private readonly shade: HTMLElement,
    placement: Placement,
    private readonly latest: () => Latest,
  ) {
    this.axis = placement === "left" ? "x" : "y";
    this.kind = prefersReducedMotion() ? "flat" : placement === "bottom" || placement === "left" ? "slide" : "rise";
  }

  // --- the panel on screen -------------------------------------------------

  private measure() {
    const size = this.axis === "y" ? this.panel.offsetHeight : this.panel.offsetWidth;
    this.extent = Math.max(1, size);
  }

  private willChange(on: boolean) {
    // The sheets keep their layer promoted all the time (they can be grabbed
    // at any moment). The rest only while they move: text on a promoted layer
    // can lose a little sharpness.
    if (this.kind === "slide") return;
    this.panel.style.willChange = on ? "transform, opacity" : "";
  }

  private paint(value: number) {
    this.value = value;
    const { style } = this.panel;
    if (this.kind === "slide") {
      style.transform =
        value === 0 ? "none" : this.axis === "y" ? `translate3d(0, ${value}px, 0)` : `translate3d(${-value}px, 0, 0)`;
      this.shade.style.opacity = String(clamp01(1 - value / this.extent));
    } else if (this.kind === "rise") {
      const open = clamp01(value);
      style.opacity = String(open);
      style.transform = value === 1 ? "none" : `translate3d(0, ${(1 - value) * RISE_PX}px, 0) scale(${0.97 + 0.03 * value})`;
      this.shade.style.opacity = String(open);
    } else {
      const open = clamp01(value);
      style.opacity = String(open);
      this.shade.style.opacity = String(open);
    }
  }

  private get rest() {
    return this.kind === "slide" ? 0 : 1;
  }

  private get away() {
    return this.kind === "slide" ? this.extent + PAD : 0;
  }

  private frame = (value: number, velocity = 0) => {
    this.speed = velocity;
    this.paint(value);
  };

  private cancel() {
    this.stop?.();
    this.stop = null;
  }

  private settle = () => {
    this.stop = null;
    if (this.phase !== "enter" && this.phase !== "idle") return;
    this.phase = "idle";
    window.clearTimeout(this.arrival);
    this.speed = 0;
    this.paint(this.rest);
    this.willChange(false);
  };

  /** From wherever it is to open, on the arriving spring. */
  private toRest(velocity: number) {
    this.cancel();
    this.willChange(true);
    this.stop =
      this.kind === "flat"
        ? tween({ from: this.value, to: this.rest, duration: FADE_MS, onFrame: this.frame, onDone: this.settle })
        : spring({
            from: this.value,
            to: this.rest,
            velocity,
            ...RISE,
            onFrame: this.frame,
            onDone: this.settle,
          });
  }

  // --- arriving ------------------------------------------------------------

  enter() {
    this.measure();
    this.phase = "enter";
    this.paint(this.kind === "slide" ? this.extent + PAD : 0);
    this.toRest(0);
    // A frame loop that never runs (a tab opened in the background) would
    // leave the sheet waiting off screen.
    this.arrival = window.setTimeout(() => {
      if (this.phase !== "enter") return;
      this.cancel();
      this.settle();
    }, ARRIVAL_SAFETY);
  }

  // --- leaving -------------------------------------------------------------

  /** The layer was asked to leave (a tap, Escape, Back, a choice). */
  setLeaving(leaving: boolean) {
    if (leaving) {
      if (this.phase === "leave") return; // our own drag-dismiss got here first
      this.beginLeave(this.phase === "drag" ? this.dragVelocity(performance.now()) : this.speed);
    } else if (this.phase === "leave") {
      // The same layer was opened again before it finished leaving: take it back.
      window.clearTimeout(this.safety);
      this.finished = false;
      this.phase = "enter";
      this.toRest(this.speed);
    }
  }

  private beginLeave(velocity: number) {
    this.cancel();
    this.drag = null;
    this.phase = "leave";
    this.finished = false;
    window.clearTimeout(this.arrival);
    window.clearTimeout(this.safety);
    this.safety = window.setTimeout(this.finish, SAFETY);

    // Put the keyboard away with the sheet, rather than a beat after it.
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== this.panel && this.panel.contains(active)) active.blur();

    this.measure();
    this.willChange(true);
    this.stop =
      this.kind === "slide"
        ? spring({
            from: this.value,
            to: this.away + AIM,
            velocity,
            ...AWAY,
            until: this.away,
            onFrame: this.frame,
            onDone: this.finish,
          })
        : tween({
            from: this.value,
            to: 0,
            duration: this.kind === "flat" ? FADE_MS : LEAVE_MS,
            ease: this.kind === "flat" ? easeOut : easeIn,
            onFrame: this.frame,
            onDone: this.finish,
          });
  }

  private finish = () => {
    if (this.finished) return;
    this.finished = true;
    window.clearTimeout(this.safety);
    this.cancel();
    this.latest().gone();
  };

  // --- fingers -------------------------------------------------------------

  private get draggable() {
    return this.kind === "slide" && this.latest().drag;
  }

  /** Whether a touch that begins here belongs to something other than the sheet. */
  private claimed(target: EventTarget | null) {
    let el = target instanceof Element ? target : null;
    while (el && el !== this.panel) {
      if (el instanceof HTMLElement) {
        if (el.isContentEditable || el.matches("input, textarea, select")) return true;
        if (scrolls(el, this.axis)) return true;
      }
      el = el.parentElement;
    }
    return false;
  }

  private along(e: PointerEvent) {
    return this.axis === "y" ? e.clientY : e.clientX;
  }

  /** How far the finger has moved since touch-down, in the direction that closes. */
  private toward(d: Drag, e: PointerEvent) {
    const moved = this.along(e) - d.start;
    return this.axis === "y" ? moved : -moved;
  }

  private onDown = (e: PointerEvent) => {
    this.swallowUntil = 0;
    if (!this.draggable || this.phase === "leave" || this.drag || !e.isPrimary) return;
    // A mouse pulls a sheet down by its handle; anywhere else it selects text.
    if (e.pointerType === "mouse") {
      const grip = e.target instanceof Element && e.target.closest("[data-sheet-grip]");
      if (e.button !== 0 || !grip) return;
    }
    if (this.claimed(e.target)) return;
    this.drag = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      started: false,
      dead: false,
      start: this.along(e),
      lead: 0,
      base: 0,
      samples: [],
    };
  };

  private onMove = (e: PointerEvent) => {
    const d = this.drag;
    if (!d || e.pointerId !== d.id || d.dead) return;

    if (!d.started) {
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (Math.hypot(dx, dy) < THRESHOLD) return;
      // The drawer lets the menu's lists scroll: only a mostly sideways
      // movement is the drawer's. The sheet takes any pull along its axis.
      const mine = this.axis === "y" ? Math.abs(dy) >= THRESHOLD : Math.abs(dx) > Math.abs(dy);
      if (!mine) {
        d.dead = true;
        return;
      }
      d.started = true;
      this.cancel();
      this.phase = "drag";
      this.measure();
      this.willChange(true);
      d.base = this.value;
      const first = this.toward(d, e);
      d.lead = Math.sign(first) * Math.min(THRESHOLD, Math.abs(first));
      try {
        this.panel.setPointerCapture(e.pointerId);
      } catch {
        // The pointer is already gone; the release will tidy up.
      }
    }

    const raw = d.base + this.toward(d, e) - d.lead;
    const shown = raw >= 0 ? raw : -band(-raw);
    d.samples.push({ t: e.timeStamp, c: shown });
    while (d.samples.length > 2 && e.timeStamp - d.samples[0].t > WINDOW * 2) d.samples.shift();
    this.frame(shown);
  };

  /** Toward-closed speed in px/s over the last stretch of the finger's path. */
  private dragVelocity(now: number): number {
    const recent = (this.drag?.samples ?? []).filter((s) => now - s.t <= WINDOW);
    if (recent.length < 2) return 0;
    const first = recent[0];
    const last = recent[recent.length - 1];
    // Two events a millisecond apart would read as a rocket.
    const seconds = Math.max((last.t - first.t) / 1000, 0.016);
    return (last.c - first.c) / seconds;
  }

  private onUp = (e: PointerEvent) => {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    if (!d.started) {
      this.drag = null; // a tap: the click that follows is the caller's
      return;
    }
    const velocity = this.dragVelocity(e.timeStamp);
    this.drag = null;
    // The click that ends a drag is not a press on whatever is under the finger.
    this.swallowUntil = performance.now() + 400;
    try {
      this.panel.releasePointerCapture(e.pointerId);
    } catch {
      // Already released.
    }
    if (this.value > this.extent * FRACTION || velocity > FLICK) {
      // Away with the finger's speed, at once; the layer is told to close in
      // the same breath and finds this already under way.
      this.beginLeave(velocity);
      this.latest().onClose();
    } else {
      this.phase = "idle";
      this.toRest(velocity);
    }
  };

  private onClick = (e: MouseEvent) => {
    if (performance.now() >= this.swallowUntil) return;
    this.swallowUntil = 0;
    e.preventDefault();
    e.stopPropagation();
  };

  // --- lists inside the sheet ----------------------------------------------

  /**
   * The browser decides at touch-down whether it will scroll or leave the
   * gesture to us, and it cannot be changed once the finger is down. The panel
   * says "don't scroll" (touch-action: none); lists inside say "scroll
   * vertically" while they can. A list with less in it than its height cannot
   * scroll, so it says "don't" too, and a finger on it drags the sheet.
   * The drawer lets every list scroll vertically and keeps the sideways
   * movement for itself.
   */
  private syncScrollers = () => {
    this.scrollSync = 0;
    for (const el of this.panel.querySelectorAll<HTMLElement>(SCROLLERS)) {
      el.style.touchAction =
        this.axis === "x" ? (scrolls(el, "x") ? "pan-x pan-y" : "pan-y") : scrolls(el, "y") ? "pan-y" : "none";
    }
  };

  private queueScrollSync = () => {
    if (!this.scrollSync) this.scrollSync = requestAnimationFrame(this.syncScrollers);
  };

  // --- lifetime ------------------------------------------------------------

  attach() {
    const { panel } = this;
    if (this.draggable) {
      panel.style.touchAction = this.axis === "y" ? "none" : "pan-y";
      panel.addEventListener("pointerdown", this.onDown);
      panel.addEventListener("pointermove", this.onMove);
      panel.addEventListener("pointerup", this.onUp);
      panel.addEventListener("pointercancel", this.onUp);
      panel.addEventListener("click", this.onClick, true);
      this.syncScrollers();
      this.mutations = new MutationObserver(this.queueScrollSync);
      this.mutations.observe(panel, { childList: true, subtree: true });
      if (typeof ResizeObserver !== "undefined") {
        this.resizes = new ResizeObserver(this.queueScrollSync);
        this.resizes.observe(panel);
      }
    }
  }

  dispose() {
    const { panel } = this;
    panel.removeEventListener("pointerdown", this.onDown);
    panel.removeEventListener("pointermove", this.onMove);
    panel.removeEventListener("pointerup", this.onUp);
    panel.removeEventListener("pointercancel", this.onUp);
    panel.removeEventListener("click", this.onClick, true);
    this.mutations?.disconnect();
    this.resizes?.disconnect();
    cancelAnimationFrame(this.scrollSync);
    this.cancel();
    window.clearTimeout(this.safety);
    window.clearTimeout(this.arrival);
  }
}

/** Undo whatever motion has written, leaving the panel as the stylesheet draws it. */
function parkAtRest(panel: HTMLElement, shade: HTMLElement) {
  panel.style.transform = "";
  panel.style.opacity = "";
  panel.style.willChange = "";
  panel.style.touchAction = "";
  shade.style.opacity = "";
}

export default function Overlay({
  label,
  placement,
  onClose,
  className = "",
  drag = true,
  children,
}: OverlayProps) {
  const panel = useDialog<HTMLDivElement>();
  const shade = useRef<HTMLDivElement>(null);
  const motion = useRef<PanelMotion | null>(null);
  const { leaving, gone } = useContext(LayerMotion);

  // What the long-lived motion needs to call, kept current without rebuilding it.
  const latest = useRef<Latest>({ onClose, gone, drag });
  useEffect(() => {
    latest.current = { onClose, gone, drag };
  });

  // Before the first paint: park the panel off screen (or transparent) and
  // start it arriving, so there is never a frame of it sitting where it ends.
  useLayoutEffect(() => {
    const node = panel.current;
    const backdrop = shade.current;
    if (!node || !backdrop) return;
    let m: PanelMotion | null = null;
    try {
      m = new PanelMotion(node, backdrop, placement, () => latest.current);
      m.attach();
      m.enter();
      motion.current = m;
    } catch (error) {
      // A layer that can't animate must still open, and still close: leave it
      // where it belongs, and let `leaving` unmount it without a show.
      console.error(error);
      m?.dispose();
      m = null;
      motion.current = null;
      parkAtRest(node, backdrop);
    }
    return () => {
      m?.dispose();
      if (motion.current === m) motion.current = null;
    };
  }, [panel, placement]);

  // Asked to close by anything: the layer stays mounted while this plays out.
  useEffect(() => {
    const m = motion.current;
    if (m) m.setLeaving(leaving);
    else if (leaving) latest.current.gone();
  }, [leaving]);

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

  // A panel on its way out takes no more taps: they fall to the backdrop,
  // which swallows them, so a second press of Go can't land.
  const panelStyle = leaving ? { ...insets, pointerEvents: "none" as const } : insets;

  const panelProps = {
    ref: panel,
    role: "dialog" as const,
    "aria-modal": true as const,
    "aria-label": label,
    tabIndex: -1,
    style: panelStyle,
  };

  const sliding = placement === "bottom" || placement === "left";

  return (
    <SheetContext.Provider value={{ onClose }}>
      <div
        ref={shade}
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px] will-change-[opacity]"
      />

      {sliding ? (
        <div {...panelProps} className={`${WRAPPER[placement]} ${PANEL[placement]} will-change-transform ${className}`}>
          {children}
        </div>
      ) : (
        <div className={WRAPPER[placement]}>
          <div {...panelProps} className={`${PANEL[placement]} ${className}`}>
            {children}
          </div>
        </div>
      )}
    </SheetContext.Provider>
  );
}
