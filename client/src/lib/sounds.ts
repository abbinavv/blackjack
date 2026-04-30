let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let compressor: DynamicsCompressorNode | null = null;

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    // Compressor keeps everything from clipping and controls dynamics
    compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 8;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.15;

    masterGain = ctx.createGain();
    masterGain.gain.value = 0.55; // global volume ceiling

    masterGain.connect(compressor);
    compressor.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function out(): AudioNode {
  getCtx();
  return masterGain!;
}

// ─── Card flip ───────────────────────────────────────────────────────────────
// Layered: bandpass-filtered paper whoosh + soft felt thump
export function playCardFlip() {
  const c = getCtx();
  const t = c.currentTime;

  // Paper whoosh — bandpass white noise
  const bufLen = Math.floor(c.sampleRate * 0.06);
  const buf = c.createBuffer(1, bufLen, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

  const src = c.createBufferSource();
  src.buffer = buf;

  const bpf = c.createBiquadFilter();
  bpf.type = 'bandpass';
  bpf.frequency.value = 3200;
  bpf.Q.value = 0.7;

  const highShelf = c.createBiquadFilter();
  highShelf.type = 'highshelf';
  highShelf.frequency.value = 6000;
  highShelf.gain.value = -6;

  const whooshGain = c.createGain();
  whooshGain.gain.setValueAtTime(0, t);
  whooshGain.gain.linearRampToValueAtTime(0.18, t + 0.004);
  whooshGain.gain.exponentialRampToValueAtTime(0.001, t + 0.065);

  src.connect(bpf);
  bpf.connect(highShelf);
  highShelf.connect(whooshGain);
  whooshGain.connect(out());
  src.start(t);

  // Felt thump — card landing on table
  const thump = c.createOscillator();
  const thumpGain = c.createGain();
  thump.type = 'sine';
  thump.frequency.setValueAtTime(110, t + 0.03);
  thump.frequency.exponentialRampToValueAtTime(55, t + 0.1);
  thumpGain.gain.setValueAtTime(0, t + 0.03);
  thumpGain.gain.linearRampToValueAtTime(0.12, t + 0.034);
  thumpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
  thump.connect(thumpGain);
  thumpGain.connect(out());
  thump.start(t + 0.03);
  thump.stop(t + 0.14);
}

// ─── Chip clink ──────────────────────────────────────────────────────────────
// Metallic ring from stacked harmonics + a subtle initial click
export function playChipClink() {
  const c = getCtx();
  const t = c.currentTime;

  // Hard click transient
  const clickLen = Math.floor(c.sampleRate * 0.004);
  const clickBuf = c.createBuffer(1, clickLen, c.sampleRate);
  const cd = clickBuf.getChannelData(0);
  for (let i = 0; i < clickLen; i++) cd[i] = (Math.random() * 2 - 1) * (1 - i / clickLen);
  const clickSrc = c.createBufferSource();
  clickSrc.buffer = clickBuf;
  const clickGain = c.createGain();
  clickGain.gain.value = 0.22;
  clickSrc.connect(clickGain);
  clickGain.connect(out());
  clickSrc.start(t);

  // Metallic ring harmonics
  const harmonics = [1050, 1680, 2310, 3150];
  harmonics.forEach((freq, i) => {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const decayTime = 0.32 - i * 0.06;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.07 / (i + 1), t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.001, t + decayTime);
    osc.connect(g);
    g.connect(out());
    osc.start(t);
    osc.stop(t + decayTime + 0.02);
  });
}

// ─── Deal (slide onto felt, slightly softer than flip) ───────────────────────
export function playDeal() {
  const c = getCtx();
  const t = c.currentTime;

  const bufLen = Math.floor(c.sampleRate * 0.09);
  const buf = c.createBuffer(1, bufLen, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) {
    const env = i < bufLen * 0.3
      ? i / (bufLen * 0.3)
      : 1 - (i - bufLen * 0.3) / (bufLen * 0.7);
    data[i] = (Math.random() * 2 - 1) * env;
  }

  const src = c.createBufferSource();
  src.buffer = buf;

  const lpf = c.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.value = 4500;

  const g = c.createGain();
  g.gain.value = 0.13;

  src.connect(lpf);
  lpf.connect(g);
  g.connect(out());
  src.start(t);
}

// ─── Win fanfare ─────────────────────────────────────────────────────────────
// Gentle ascending chime, sine waves with soft envelope
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
    osc.connect(g);
    g.connect(out());
    osc.start(st);
    osc.stop(st + 0.5);
  });
}

// ─── Blackjack fanfare ───────────────────────────────────────────────────────
// More celebratory — two-voice ascending run
export function playBlackjack() {
  const c = getCtx();
  const t = c.currentTime;
  const melody = [523, 659, 784, 1047, 1319];
  const harmony = [392, 494, 587, 784, 988];
  [...melody, ...harmony].forEach((freq, i) => {
    const isHarmony = i >= melody.length;
    const idx = isHarmony ? i - melody.length : i;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const st = t + idx * 0.1 + (isHarmony ? 0.04 : 0);
    g.gain.setValueAtTime(0, st);
    g.gain.linearRampToValueAtTime(isHarmony ? 0.08 : 0.13, st + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, st + 0.5);
    osc.connect(g);
    g.connect(out());
    osc.start(st);
    osc.stop(st + 0.55);
  });
}

// ─── Lose ────────────────────────────────────────────────────────────────────
// Soft descending minor thirds — not harsh, just a gentle "aww"
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
    osc.connect(g);
    g.connect(out());
    osc.start(st);
    osc.stop(st + 0.4);
  });
}

// ─── Bust ────────────────────────────────────────────────────────────────────
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
  osc.connect(g);
  g.connect(out());
  osc.start(t);
  osc.stop(t + 0.3);
}

// ─── UI button click ─────────────────────────────────────────────────────────
// Barely audible soft click — just enough tactile feedback
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
  src.connect(lpf);
  lpf.connect(g);
  g.connect(out());
  src.start(t);
}
