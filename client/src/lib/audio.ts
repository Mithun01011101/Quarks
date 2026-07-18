import { soundEnabled } from "./settings";

/**
 * All app sounds are synthesized with WebAudio — no audio files.
 * The context must be created/resumed inside a user gesture (iOS rule), so
 * initAudio() is called from pointerdown before any sound plays.
 */
let ctx: AudioContext | null = null;

export function initAudio() {
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    ctx = null;
  }
}

function tone(freq: number, at: number, dur = 0.35, peak = 0.12) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(peak, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

/** Two quick rising sines — the everyday completion chime. */
export function playComplete() {
  if (!soundEnabled()) return;
  initAudio();
  if (!ctx) return;
  const t = ctx.currentTime + 0.01;
  tone(659.25, t); // E5
  tone(987.77, t + 0.06); // B5
}

/** Slow rising arpeggio for milestones and finished focus sessions. */
export function playMilestone() {
  if (!soundEnabled()) return;
  initAudio();
  if (!ctx) return;
  const t = ctx.currentTime + 0.01;
  tone(659.25, t, 0.45); // E5
  tone(830.61, t + 0.09, 0.45); // G#5
  tone(987.77, t + 0.18, 0.55); // B5
}
