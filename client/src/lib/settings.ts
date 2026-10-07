/**
 * Per-device preferences (sound, haptics). Stored in localStorage — a chime on
 * the phone and silence on the desktop is a feature, not a bug.
 */
const SOUND_KEY = "quarks-sound";
const HAPTICS_KEY = "quarks-haptics";

function flag(key: string): boolean {
  try {
    return localStorage.getItem(key) !== "off";
  } catch {
    return true;
  }
}

function setFlag(key: string, on: boolean) {
  try {
    localStorage.setItem(key, on ? "on" : "off");
  } catch {
    // best-effort
  }
}

export const soundEnabled = () => flag(SOUND_KEY);
export const hapticsEnabled = () => flag(HAPTICS_KEY);
export const setSoundEnabled = (on: boolean) => setFlag(SOUND_KEY, on);
export const setHapticsEnabled = (on: boolean) => setFlag(HAPTICS_KEY, on);

/** Guarded vibration — no-ops on iOS Safari (no navigator.vibrate) and when off. */
export function vibrate(pattern: number | number[]) {
  if (!hapticsEnabled()) return;
  try {
    if ("vibrate" in navigator) navigator.vibrate(pattern);
  } catch {
    // best-effort
  }
}

/** Cancel any in-flight vibration (always runs, even with haptics off). */
export function stopVibration() {
  try {
    if ("vibrate" in navigator) navigator.vibrate(0);
  } catch {
    // best-effort
  }
}

/** A haptic that starts after a short silence, so it reads as its own beat
 *  after the hold's continuous hum instead of just stretching it. */
function afterHum(pattern: number | number[]) {
  stopVibration();
  window.setTimeout(() => vibrate(pattern), 60);
}

/** The "done" reward: a light tap then a firmer one. */
export const hapticSuccess = () => afterHum([18, 70, 42]);

/** Undo: one light tick. */
export const hapticTick = () => afterHum(15);
