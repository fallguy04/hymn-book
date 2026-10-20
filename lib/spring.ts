/**
 * A damped spring, for things that should move like objects.
 *
 * A sheet that rises on a spring and lands, and that carries a finger's speed
 * off the screen when it is flicked away, cannot be a fixed-duration easing
 * curve: where it goes depends on where it is and how fast it is already
 * moving. So this starts from the current value and the current velocity, and
 * integrates real elapsed time, frame by frame.
 *
 * The spring is the textbook one. With a period `response` (seconds) and a
 * damping ratio `damping` (1 is critically damped: no overshoot; below 1 it
 * overshoots and settles):
 *
 *   k = (2π / response)²          stiffness
 *   c = 2 · damping · √k          friction
 *   a = −k·(x − target) − c·v
 *
 * No runtime imports, so Node can load it for the tests.
 */

export interface SpringFeel {
  /** The spring's period in seconds: smaller is quicker. */
  response: number;
  /** 1 settles without overshoot; below 1 overshoots a little and rings down. */
  damping: number;
}

/** A sheet or drawer arriving: a small overshoot as it lands. */
export const RISE: SpringFeel = { response: 0.42, damping: 0.86 };
/** A sheet leaving: no overshoot, it only needs to get out of the way. */
export const AWAY: SpringFeel = { response: 0.34, damping: 1 };

export interface SpringState {
  /** Position (px). */
  x: number;
  /** Velocity (px/s). */
  v: number;
}

/** A slow frame is worth at most this much time, so a hiccup can't fling things. */
const MAX_FRAME = 0.05;
/** The integrator's own step. Small enough to be stable for any feel used here. */
const SUBSTEP = 1 / 240;

/**
 * Advance a spring by `dt` seconds toward `target`. Pure: returns the new
 * state. Semi-implicit Euler in small substeps, so a long `dt` (a slow frame,
 * a backgrounded tab coming back) still lands where the physics says, instead
 * of blowing up.
 */
export function stepSpring(state: SpringState, target: number, feel: SpringFeel, dt: number): SpringState {
  let { x, v } = state;
  if (!(dt > 0)) return { x, v };
  const k = (2 * Math.PI / Math.max(feel.response, 0.01)) ** 2;
  const c = 2 * feel.damping * Math.sqrt(k);
  const steps = Math.max(1, Math.ceil(dt / SUBSTEP));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    v += (-k * (x - target) - c * v) * h;
    x += v * h;
  }
  return { x, v };
}

export interface SpringOptions extends SpringFeel {
  from: number;
  to: number;
  /** Where it is already heading, px/s. A flicked sheet leaves at the finger's speed. */
  velocity?: number;
  onFrame: (value: number, velocity: number) => void;
  /** Called once, after the last frame, when the spring settles or reaches `until`. */
  onDone?: () => void;
  /**
   * Stop as soon as the value passes this, travelling toward `to`. For a
   * sheet leaving: done the moment it is off the screen, instead of waiting
   * for an exponential tail nobody can see.
   */
  until?: number;
}

/** Close enough to rest: under a quarter of a pixel, and drifting under 4px/s. */
const REST_DISTANCE = 0.25;
const REST_SPEED = 4;

/**
 * Run a spring from `from` toward `to` on animation frames. Returns a cancel
 * function; after it is called no further callbacks arrive, `onDone` included.
 * The caller decides what a cancelled animation leaves behind.
 */
export function spring(options: SpringOptions): () => void {
  const { from, to, velocity = 0, until, onFrame, onDone } = options;
  const feel: SpringFeel = { response: options.response, damping: options.damping };

  if (![from, to, velocity].every(Number.isFinite)) {
    onFrame(Number.isFinite(to) ? to : 0, 0);
    onDone?.();
    return () => {};
  }

  let state: SpringState = { x: from, v: velocity };
  let last = performance.now();
  let frame = 0;
  let live = true;

  const tick = (now: number) => {
    if (!live) return;
    const dt = Math.min(Math.max((now - last) / 1000, 0), MAX_FRAME);
    last = now;
    state = stepSpring(state, to, feel, dt);

    const passed = until !== undefined && (to >= from ? state.x >= until : state.x <= until);
    const rested = Math.abs(state.x - to) < REST_DISTANCE && Math.abs(state.v) < REST_SPEED;
    if (passed || rested) {
      live = false;
      if (rested && !passed) onFrame(to, 0);
      else onFrame(state.x, state.v);
      onDone?.();
      return;
    }
    onFrame(state.x, state.v);
    frame = requestAnimationFrame(tick);
  };

  frame = requestAnimationFrame(tick);
  return () => {
    live = false;
    cancelAnimationFrame(frame);
  };
}

export const easeOut = (t: number) => 1 - (1 - t) ** 3;
export const easeIn = (t: number) => t * t;

export interface TweenOptions {
  from: number;
  to: number;
  /** Milliseconds. */
  duration: number;
  ease?: (t: number) => number;
  onFrame: (value: number) => void;
  onDone?: () => void;
}

/**
 * A plain timed ease, for the people who asked their phone for less motion:
 * a quick fade, no spring. Same contract as `spring`: returns a cancel.
 */
export function tween({ from, to, duration, ease = easeOut, onFrame, onDone }: TweenOptions): () => void {
  const began = performance.now();
  let frame = 0;
  let live = true;
  const tick = (now: number) => {
    if (!live) return;
    const t = duration > 0 ? Math.min(Math.max((now - began) / duration, 0), 1) : 1;
    onFrame(from + (to - from) * ease(t));
    if (t >= 1) {
      live = false;
      onDone?.();
      return;
    }
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => {
    live = false;
    cancelAnimationFrame(frame);
  };
}

/** Whether this person has asked their device for less motion. */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
