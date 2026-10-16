import { useSyncExternalStore } from "react";

/**
 * Install state for the PWA, kept outside React.
 *
 * Chrome fires `beforeinstallprompt` once, shortly after load, and does not
 * repeat it. The install card lives in the menu drawer, which is not mounted
 * until someone opens it, so a listener added by the card was attached long
 * after the event had come and gone: Android was almost never offered the app.
 *
 * So the listener lives here instead. `startInstallCapture` attaches it as
 * early as the bundle runs and keeps the event; the UI reads it whenever it
 * happens to mount, through `useInstallState`, and spends it with
 * `promptInstall`.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallPlatform = "android" | "ios" | "other";

export interface InstallState {
  /** Which install route this device has: the prompt, the Share sheet, or neither. */
  platform: InstallPlatform;
  /** Already running as an installed app (or just became one). */
  installed: boolean;
  /** The browser has handed over an install prompt that `promptInstall` can show. */
  canPrompt: boolean;
}

export type InstallResult = "accepted" | "dismissed" | "unavailable";

/** What the server, and the first client render, see: nothing known yet. */
const SERVER_STATE: InstallState = { platform: "other", installed: false, canPrompt: false };

let started = false;
let deferred: BeforeInstallPromptEvent | null = null;
let sawAppInstalled = false;
let prompting: Promise<InstallResult> | null = null;

const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

/**
 * Begin listening for the install prompt. Safe to call any number of times, and
 * called both when this module loads and from the root layout's service-worker
 * component, so the listener is there before the page has finished loading.
 */
export function startInstallCapture(): void {
  if (started || typeof window === "undefined") return;
  started = true;

  window.addEventListener("beforeinstallprompt", (event) => {
    // Without this Chrome shows its own mini-infobar and the event is spent on
    // it. Holding it back is what lets the app choose when to ask.
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    notify();
  });

  window.addEventListener("appinstalled", () => {
    sawAppInstalled = true;
    // The event is single-use and the app is now installed; nothing to offer.
    deferred = null;
    notify();
  });
}

function detectPlatform(): InstallPlatform {
  const ua = navigator.userAgent;

  // Only Safari can add to the Home Screen from its Share sheet here, so the
  // iOS builds of Chrome, Firefox and Edge don't count. iPadOS 13+ reports a
  // Macintosh user agent, so an iPad matched neither the iOS test nor
  // beforeinstallprompt and was simply never offered the app. A Mac with a
  // touchscreen doesn't exist; multiple touch points plus a Macintosh UA does
  // mean iPad.
  const appleTouch =
    /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  if (appleTouch && !/crios|fxios|edgios|opios/i.test(ua)) return "ios";

  if (/android/i.test(ua)) return "android";
  return "other";
}

function detectInstalled(): boolean {
  return (
    sawAppInstalled ||
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari reports standalone on navigator, not via the media query.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * useSyncExternalStore compares snapshots by identity, so an object rebuilt on
 * every read would re-render forever. Hand back the previous one unless a field
 * actually changed.
 */
let snapshot: InstallState = SERVER_STATE;

function getSnapshot(): InstallState {
  const next: InstallState = {
    platform: detectPlatform(),
    installed: detectInstalled(),
    canPrompt: deferred !== null,
  };
  if (
    next.platform === snapshot.platform &&
    next.installed === snapshot.installed &&
    next.canPrompt === snapshot.canPrompt
  ) {
    return snapshot;
  }
  snapshot = next;
  return snapshot;
}

function getServerSnapshot(): InstallState {
  return SERVER_STATE;
}

function subscribe(onChange: () => void): () => void {
  // A component can mount before anything else has started the capture.
  startInstallCapture();

  listeners.add(onChange);

  // Launching from the Home Screen can flip display-mode under a live page.
  const media = window.matchMedia("(display-mode: standalone)");
  media.addEventListener("change", onChange);

  return () => {
    listeners.delete(onChange);
    media.removeEventListener("change", onChange);
  };
}

/**
 * Where this device stands on installing. On the server and during hydration
 * this is `{ platform: "other", installed: false, canPrompt: false }`, so
 * anything built on it should treat "other, not installed, can't prompt" as
 * "show nothing".
 */
export function useInstallState(): InstallState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Show the browser's install dialog. Must be called from a tap or click: the
 * browser refuses to open it otherwise. The captured event can be used once, so
 * it is spent whatever the answer; `canPrompt` goes false and Chrome will
 * offer a fresh event later if the user said no.
 */
export function promptInstall(): Promise<InstallResult> {
  // A second tap while the dialog is open would call prompt() on a spent event.
  if (prompting) return prompting;

  const event = deferred;
  if (!event) return Promise.resolve("unavailable");

  const run = async (): Promise<InstallResult> => {
    try {
      await event.prompt();
      const { outcome } = await event.userChoice;
      deferred = null;
      return outcome;
    } catch (error) {
      // Called outside a user gesture: the dialog never opened and the event is
      // still good for a properly-triggered attempt. Anything else means it was
      // already spent.
      const refused = error instanceof DOMException && error.name === "NotAllowedError";
      if (!refused) deferred = null;
      return "unavailable";
    }
  };

  // `finally` on the outer promise, not inside `run`: if prompt() throws before
  // its first await, the cleanup would otherwise run before `prompting` is set
  // and leave a finished promise stuck there.
  prompting = run().finally(() => {
    prompting = null;
    notify();
  });
  return prompting;
}

// As early as this bundle runs, rather than waiting for a component to mount.
if (typeof window !== "undefined") startInstallCapture();
