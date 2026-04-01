/**
 * audioAlertService.ts — FloodSat AI
 * Generates alert tones using Web Audio API (no external files required).
 * Each alert level plays EXACTLY 2 rings/pulses per trigger.
 */

type AlertLevel = 'watch' | 'warning' | 'critical';

const STORAGE_KEY = 'floodsat_audio_muted';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

/** Resume context if suspended (browser autoplay policy) */
async function ensureResumed(): Promise<AudioContext | null> {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    return ctx;
  } catch {
    return null;
  }
}

/**
 * Play a tone sequence using OscillatorNode.
 * notes: array of { freq, duration, delay } in seconds
 */
function playToneSequence(
  ctx: AudioContext,
  notes: { freq: number; duration: number; delay: number; type?: OscillatorType }[],
  gain = 0.35
) {
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(gain, ctx.currentTime);
  masterGain.connect(ctx.destination);

  notes.forEach(({ freq, duration, delay, type = 'sine' }) => {
    const osc = ctx.createOscillator();
    const envGain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);

    // Envelope: attack 0.01s, sustain, release 0.05s
    envGain.gain.setValueAtTime(0, ctx.currentTime + delay);
    envGain.gain.linearRampToValueAtTime(1, ctx.currentTime + delay + 0.01);
    envGain.gain.setValueAtTime(1, ctx.currentTime + delay + duration - 0.05);
    envGain.gain.linearRampToValueAtTime(0, ctx.currentTime + delay + duration);

    osc.connect(envGain);
    envGain.connect(masterGain);

    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration);
  });
}

/**
 * Watch level — 2 gentle pings (low priority)
 * Soft sine wave at 880 Hz × 2 rings
 */
async function playWatchSound() {
  const ctx = await ensureResumed();
  if (!ctx) return;
  playToneSequence(ctx, [
    { freq: 880, duration: 0.22, delay: 0,    type: 'sine' },
    { freq: 880, duration: 0.22, delay: 0.35, type: 'sine' },
  ], 0.2);
}

/**
 * Warning level — 2 descending chimes (medium priority)
 * Ring 1: 1046 Hz, Ring 2: 880 Hz
 */
async function playWarningSound() {
  const ctx = await ensureResumed();
  if (!ctx) return;
  playToneSequence(ctx, [
    { freq: 1046, duration: 0.22, delay: 0,    type: 'sine' },
    { freq: 880,  duration: 0.22, delay: 0.35, type: 'sine' },
  ], 0.3);
}

/**
 * Critical level — 2 urgent pulses (high priority)
 * Square wave: Ring 1 at 1200 Hz, Ring 2 at 1400 Hz
 */
async function playCriticalSound() {
  const ctx = await ensureResumed();
  if (!ctx) return;
  playToneSequence(ctx, [
    { freq: 1200, duration: 0.18, delay: 0,    type: 'square' },
    { freq: 1400, duration: 0.22, delay: 0.30, type: 'square' },
  ], 0.28);
}

/** Play alert sound based on level */
export async function playAlertSound(level: AlertLevel) {
  if (isMuted()) return;
  switch (level) {
    case 'critical': return playCriticalSound();
    case 'warning':  return playWarningSound();
    case 'watch':    return playWatchSound();
  }
}

/** Play a soft "bell" sound for the bell icon click */
export async function playBellClick() {
  const ctx = await ensureResumed();
  if (!ctx) return;
  playToneSequence(ctx, [
    { freq: 1318, duration: 0.15, delay: 0,    type: 'sine' },
    { freq: 1046, duration: 0.20, delay: 0.12, type: 'sine' },
  ], 0.25);
}

/** Mute state helpers */
export function isMuted(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

export function setMuted(muted: boolean): void {
  localStorage.setItem(STORAGE_KEY, String(muted));
}

export function toggleMute(): boolean {
  const next = !isMuted();
  setMuted(next);
  return next;
}

/**
 * Unlock audio context on first user interaction.
 * Call this once from a click handler anywhere in the app.
 */
export function unlockAudio() {
  ensureResumed();
}
