// ─── Real audio files (public/sounds/) ───────────────────────────────────────
// Preloaded on first use, reused thereafter
const audioCache = new Map<string, HTMLAudioElement>();

function getAudio(src: string): HTMLAudioElement {
  if (!audioCache.has(src)) {
    const el = new Audio(src);
    el.preload = 'auto';
    audioCache.set(src, el);
  }
  return audioCache.get(src)!;
}

function playAudio(src: string, volume = 1, startAt = 0, stopAt?: number) {
  try {
    const original = getAudio(src);
    // Clone so multiple simultaneous plays work
    const el = original.cloneNode() as HTMLAudioElement;
    el.volume = Math.min(1, Math.max(0, volume));
    el.currentTime = startAt;
    el.play().catch(() => {});
    if (stopAt !== undefined) {
      setTimeout(() => { el.pause(); }, (stopAt - startAt) * 1000);
    }
  } catch {}
}

// ─── Web Audio for synthesized sounds ────────────────────────────────────────
let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let compressor: DynamicsCompressorNode | null = null;

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 8;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.15;
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.55;
    masterGain.connect(compressor);
    compressor.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function out(): AudioNode { getCtx(); return masterGain!; }

// ─── Chip clink — real audio (both blackjack + roulette) ─────────────────────
export function playChipClink() {
  playAudio('/sounds/chips.mp3', 0.7);
}

export function playRouletteChip() {
  playAudio('/sounds/chips.mp3', 0.65);
}

// ─── All-in chip push ─────────────────────────────────────────────────────────
export function playAllIn() {
  playAudio('/sounds/allin.mp3', 0.8);
}

// ─── Card deal — real audio ───────────────────────────────────────────────────
// The file is 25s of continuous dealing; play a 0.6s slice per card
let dealOffset = 0;
export function playCardFlip() {
  playAudio('/sounds/deal.mp3', 0.6, dealOffset, dealOffset + 0.55);
  dealOffset = (dealOffset + 0.7) % 8; // cycle through first 8s
}

export function playDeal() {
  playAudio('/sounds/deal.mp3', 0.55, dealOffset, dealOffset + 0.55);
  dealOffset = (dealOffset + 0.7) % 8;
}

// ─── Deck shuffle — real audio ────────────────────────────────────────────────
export function playShuffle() {
  playAudio('/sounds/shuffle.mp3', 0.7);
}

// ─── Roulette wheel spin — real audio ─────────────────────────────────────────
// File is 8.3s; play full clip and stop at durationMs
let wheelAudio: HTMLAudioElement | null = null;

export function playRouletteWheelSpin(durationMs = 3000) {
  if (wheelAudio) { wheelAudio.pause(); wheelAudio.currentTime = 0; }
  wheelAudio = getAudio('/sounds/wheel.mp3').cloneNode() as HTMLAudioElement;
  wheelAudio.volume = 0.75;
  wheelAudio.currentTime = 0;
  wheelAudio.play().catch(() => {});
  setTimeout(() => { if (wheelAudio) { wheelAudio.pause(); wheelAudio = null; } }, durationMs + 200);
}

// ─── Roulette ball drop — synthesized ────────────────────────────────────────
export function playRouletteBallDrop() {
  const c = getCtx();
  const t = c.currentTime;

  const thud = c.createOscillator();
  const thudG = c.createGain();
  thud.type = 'sine';
  thud.frequency.setValueAtTime(180, t);
  thud.frequency.exponentialRampToValueAtTime(60, t + 0.12);
  thudG.gain.setValueAtTime(0.18, t);
  thudG.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  thud.connect(thudG); thudG.connect(out());
  thud.start(t); thud.stop(t + 0.18);

  const ring = c.createOscillator();
  const ringG = c.createGain();
  ring.type = 'sine';
  ring.frequency.value = 3200;
  ringG.gain.setValueAtTime(0.06, t + 0.01);
  ringG.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  ring.connect(ringG); ringG.connect(out());
  ring.start(t + 0.01); ring.stop(t + 0.45);

  [0.08, 0.18, 0.26].forEach((offset, i) => {
    const b = c.createOscillator();
    const bg = c.createGain();
    b.type = 'sine';
    b.frequency.value = 1600 - i * 200;
    bg.gain.setValueAtTime(0.04 / (i + 1), t + offset);
    bg.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.07);
    b.connect(bg); bg.connect(out());
    b.start(t + offset); b.stop(t + offset + 0.09);
  });
}

// ─── Win fanfare — synthesized ────────────────────────────────────────────────
export function playWin() {
  const c = getCtx();
  const t = c.currentTime;
  [523, 659, 784, 1047].forEach((freq, i) => {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const st = t + i * 0.13;
    g.gain.setValueAtTime(0, st);
    g.gain.linearRampToValueAtTime(0.14, st + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, st + 0.45);
    osc.connect(g); g.connect(out());
    osc.start(st); osc.stop(st + 0.5);
  });
}

// ─── Blackjack fanfare — synthesized ─────────────────────────────────────────
export function playBlackjack() {
  const c = getCtx();
  const t = c.currentTime;
  const melody  = [523, 659, 784, 1047, 1319];
  const harmony = [392, 494,  587,  784,  988];
  [...melody, ...harmony].forEach((freq, i) => {
    const isH = i >= melody.length;
    const idx = isH ? i - melody.length : i;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const st = t + idx * 0.1 + (isH ? 0.04 : 0);
    g.gain.setValueAtTime(0, st);
    g.gain.linearRampToValueAtTime(isH ? 0.08 : 0.13, st + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, st + 0.5);
    osc.connect(g); g.connect(out());
    osc.start(st); osc.stop(st + 0.55);
  });
}

// ─── Lose — synthesized ───────────────────────────────────────────────────────
export function playLose() {
  const c = getCtx();
  const t = c.currentTime;
  [294, 247, 220].forEach((freq, i) => {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const st = t + i * 0.18;
    g.gain.setValueAtTime(0, st);
    g.gain.linearRampToValueAtTime(0.1, st + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, st + 0.35);
    osc.connect(g); g.connect(out());
    osc.start(st); osc.stop(st + 0.4);
  });
}

// ─── Bust — synthesized ───────────────────────────────────────────────────────
export function playBust() {
  const c = getCtx();
  const t = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(220, t);
  osc.frequency.exponentialRampToValueAtTime(110, t + 0.25);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.12, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
  osc.connect(g); g.connect(out());
  osc.start(t); osc.stop(t + 0.3);
}

// ─── UI button click — synthesized ───────────────────────────────────────────
export function playButton() {
  const c = getCtx();
  const t = c.currentTime;
  const bufLen = Math.floor(c.sampleRate * 0.012);
  const buf = c.createBuffer(1, bufLen, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufLen);
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.value = 0.08;
  const lpf = c.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.value = 2000;
  src.connect(lpf); lpf.connect(g); g.connect(out());
  src.start(t);
}
