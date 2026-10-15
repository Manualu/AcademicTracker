// Sonidos de Remontada. Todo se genera en la app: no hay archivos de audio que bajar ni
// licencias que cuidar, y funciona sin conexión.
//  - Efectos cortos (arranque de máquina, campana, cajón) y música del parque: Web Audio.
//  - Ambientes para estudiar (ruidos, lluvia, olas, fábrica): se generan una vez como un loop
//    WAV y se reproducen con un <audio>. Así siguen sonando con el celular bloqueado y el
//    reproductor de la pantalla bloqueada muestra la sesión (Media Session).
import { useEffect, useState } from "react";
import { getPrefs, type AmbientKind } from "./prefs";

// ------------------------------------------------------------------ contexto
let ac: AudioContext | null = null;
function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ac) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ac = new C();
  }
  return ac;
}
/** iOS y Chrome solo dejan sonar después de un toque: se destraba con el primero. */
export function installAudioUnlock() {
  const unlock = () => { const c = ctx(); if (c && c.state !== "running") void c.resume(); };
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock);
}

// ------------------------------------------------------------------ efectos
export type Sfx = "start" | "bell" | "crate" | "pause" | "resume";

function noiseBuffer(c: BaseAudioContext, sec: number) {
  const b = c.createBuffer(1, Math.ceil(sec * c.sampleRate), c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
function tone(c: AudioContext, out: AudioNode, type: OscillatorType, f: number, t: number, dur: number, vol: number, attack = 0.005, f2?: number) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur * 0.9);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.05);
}
function burst(c: AudioContext, out: AudioNode, t: number, dur: number, vol: number, freq: number, q = 1.2) {
  const s = c.createBufferSource(); s.buffer = noiseBuffer(c, dur);
  const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(out); s.start(t);
}

export function sfx(kind: Sfx) {
  if (!getPrefs().sfx) return;
  const c = ctx(); if (!c) return;
  if (c.state !== "running") void c.resume();
  const t = c.currentTime + 0.02;
  const out = c.createGain(); out.gain.value = 0.8; out.connect(c.destination);
  if (kind === "start") {
    // Palanca, motor que arranca y toma vueltas, y un "listo"
    burst(c, out, t, 0.09, 0.5, 1800, 2);
    tone(c, out, "sine", 70, t, 0.25, 0.5);
    const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(180, t + 0.1); lp.frequency.exponentialRampToValueAtTime(900, t + 1.3); lp.connect(out);
    tone(c, lp, "sawtooth", 38, t + 0.1, 1.5, 0.22, 0.25, 96);
    tone(c, lp, "sawtooth", 57, t + 0.1, 1.5, 0.12, 0.25, 144);
    burst(c, out, t + 0.15, 1.3, 0.06, 600, 0.7);
    tone(c, out, "sine", 1318, t + 1.35, 0.5, 0.12);
    tone(c, out, "sine", 1760, t + 1.45, 0.6, 0.1);
  } else if (kind === "bell") {
    // Campana de fin de bloque (como la de la fábrica, pero amable)
    for (const [f, d, v] of [[784, 2.2, 0.22], [1568, 1.4, 0.08], [2350, 0.8, 0.04]] as const) tone(c, out, "sine", f, t, d, v);
    for (const [f, d, v] of [[1046, 2.4, 0.2], [2092, 1.4, 0.07]] as const) tone(c, out, "sine", f, t + 0.32, d, v);
  } else if (kind === "crate") {
    // Golpes de madera, la tapa que cede y un brillo
    [0, 0.16, 0.3].forEach((d, i) => burst(c, out, t + d, 0.12, 0.45 - i * 0.08, 520 + i * 60, 3));
    tone(c, out, "sine", 140, t + 0.62, 0.3, 0.25, 0.01, 90);
    burst(c, out, t + 0.6, 0.4, 0.12, 2400, 0.8);
    [1318, 1568, 2093, 2637].forEach((f, i) => tone(c, out, "triangle", f, t + 0.8 + i * 0.07, 0.6, 0.08));
  } else if (kind === "pause") {
    tone(c, out, "sine", 660, t, 0.18, 0.12, 0.005, 440);
  } else if (kind === "resume") {
    tone(c, out, "sine", 440, t, 0.18, 0.12, 0.005, 660);
  }
}

// ------------------------------------------------------------------ ambientes
export const AMBIENTS: { k: AmbientKind; n: string; d: string }[] = [
  { k: "lluvia", n: "Lluvia", d: "Lluvia pareja sobre el techo" },
  { k: "fabrica", n: "Fábrica lejana", d: "Zumbido, prensa y golpes a lo lejos" },
  { k: "olas", n: "Olas", d: "Mar que va y viene" },
  { k: "marron", n: "Ruido marrón", d: "Grave y envolvente" },
  { k: "rosa", n: "Ruido rosa", d: "Equilibrado, el más usado para concentrarse" },
  { k: "blanco", n: "Ruido blanco", d: "Tapa todo, más agudo" },
];

const SR = 24000;
const LOOP = 30; // segundos
const FADE = 1.5;

/** Genera el loop de un ambiente (mono) con cruce al final para que no se note el empalme. */
export function synth(kind: AmbientKind): Float32Array {
  const L = SR * LOOP, X = Math.round(SR * FADE), N = L + X;
  const a = new Float32Array(N);
  let rnd = 0x9e3779b9 ^ kind.length * 7919;
  const r = () => { rnd ^= rnd << 13; rnd ^= rnd >>> 17; rnd ^= rnd << 5; return ((rnd >>> 0) / 4294967296) * 2 - 1; };
  // Fuentes de ruido
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, br = 0;
  const pink = () => {
    const w = r();
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    const o = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362; b6 = w * 0.115926; return o * 0.11;
  };
  const brown = () => { br = (br + 0.02 * r()) / 1.02; return br * 3.5; };
  const TAU = Math.PI * 2;

  if (kind === "blanco") for (let i = 0; i < N; i++) a[i] = r() * 0.5;
  else if (kind === "rosa") for (let i = 0; i < N; i++) a[i] = pink();
  else if (kind === "marron") for (let i = 0; i < N; i++) a[i] = brown();
  else if (kind === "lluvia") {
    let hp = 0, prev = 0, lp = 0;
    for (let i = 0; i < N; i++) {
      const p = pink(); hp = 0.97 * (hp + p - prev); prev = p; lp += (hp - lp) * 0.55;
      a[i] = lp * 0.9 + brown() * 0.18;
    }
    // Gotas: golpecitos cortos con una resonancia aguda
    const drops = LOOP * 38;
    for (let k = 0; k < drops; k++) {
      const at = Math.floor(((r() + 1) / 2) * L), f = 1800 + ((r() + 1) / 2) * 3600, v = 0.04 + ((r() + 1) / 2) * 0.12, len = Math.floor(SR * 0.025);
      for (let j = 0; j < len && at + j < N; j++) a[at + j] += Math.sin((TAU * f * j) / SR) * v * Math.exp(-j / (len * 0.25));
    }
  } else if (kind === "olas") {
    const per = LOOP / 4; // 4 olas por loop
    let lp = 0;
    for (let i = 0; i < N; i++) {
      const t = (i % L) / SR, ph = (t % per) / per;
      const env = Math.pow(Math.sin(Math.PI * Math.min(1, ph * 1.25)), 2) * 0.85 + 0.15;
      const w = brown() * 0.7 + pink() * 0.6 * env; lp += (w - lp) * (0.12 + env * 0.5);
      a[i] = lp * (0.35 + env * 0.85);
    }
  } else if (kind === "fabrica") {
    let lp = 0;
    for (let i = 0; i < N; i++) {
      const t = i / SR;
      lp += (brown() - lp) * 0.08;
      a[i] = lp * 0.9 + (Math.sin(TAU * 50 * t) * 0.05 + Math.sin(TAU * 100 * t) * 0.03 + Math.sin(TAU * 150 * t) * 0.012);
    }
    // Prensa (golpe sordo) cada 1,875 s y un clank metálico de vez en cuando, todo lejano
    const thump = SR * 1.875;
    for (let at = Math.floor(SR * 0.4); at < L; at += thump) {
      for (let j = 0; j < SR * 0.35 && at + j < N; j++) a[at + j] += Math.sin((TAU * 55 * j) / SR) * 0.32 * Math.exp(-j / (SR * 0.07));
    }
    const clanks = [2.1, 7.6, 11.2, 16.9, 21.3, 26.4];
    for (const s of clanks) {
      const at = Math.floor(s * SR);
      for (let j = 0; j < SR * 0.9 && at + j < N; j++) {
        const e = Math.exp(-j / (SR * 0.18));
        a[at + j] += (Math.sin((TAU * 523 * j) / SR) * 0.05 + Math.sin((TAU * 1307 * j) / SR) * 0.03 + Math.sin((TAU * 2011 * j) / SR) * 0.015) * e;
      }
    }
  }
  // Cruce: el final se funde con el principio
  for (let i = 0; i < X; i++) { const k = i / X; a[i] = a[i] * k + a[L + i] * (1 - k); }
  const out = a.subarray(0, L);
  // Todos al mismo volumen percibido (por energía), sin pasarse del tope
  let peak = 0, e = 0; for (let i = 0; i < L; i++) { peak = Math.max(peak, Math.abs(out[i])); e += out[i] * out[i]; }
  const rms = Math.sqrt(e / L);
  const g = Math.min(0.95 / (peak || 1), (kind === "blanco" ? 0.12 : 0.16) / (rms || 1));
  for (let i = 0; i < L; i++) out[i] *= g;
  return out;
}

function wav(samples: Float32Array): Blob {
  const n = samples.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, SR, true);
  v.setUint32(28, SR * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 0x7fff, true);
  return new Blob([buf], { type: "audio/wav" });
}

const urls = new Map<AmbientKind, string>();
const urlFor = (k: AmbientKind) => { let u = urls.get(k); if (!u) { u = URL.createObjectURL(wav(synth(k))); urls.set(k, u); } return u; };

let el: HTMLAudioElement | null = null;
let playingKind: AmbientKind | null = null;
type AmbientState = { kind: AmbientKind | null; playing: boolean; blocked: boolean };
let amb: AmbientState = { kind: null, playing: false, blocked: false };
const ambSubs = new Set<(s: AmbientState) => void>();
const setAmb = (p: Partial<AmbientState>) => { amb = { ...amb, ...p }; ambSubs.forEach((f) => f(amb)); };
export function useAmbient() {
  const [s, set] = useState(amb);
  useEffect(() => { ambSubs.add(set); return () => { ambSubs.delete(set); }; }, []);
  return s;
}

function audioEl() {
  if (!el) {
    el = new Audio();
    el.loop = true;
    el.preload = "auto";
    el.setAttribute("playsinline", "");
    el.addEventListener("play", () => setAmb({ playing: true, blocked: false }));
    el.addEventListener("pause", () => setAmb({ playing: false }));
  }
  return el;
}

/** Pone a sonar un ambiente (o lo apaga con null). Si el navegador lo bloquea, queda `blocked`. */
export async function playAmbient(kind: AmbientKind | null, vol = getPrefs().ambientVol) {
  const a = audioEl();
  if (!kind) { a.pause(); playingKind = null; setAmb({ kind: null, playing: false, blocked: false }); return; }
  if (playingKind !== kind) { a.src = urlFor(kind); playingKind = kind; }
  a.volume = Math.max(0, Math.min(1, vol));
  setAmb({ kind });
  try { await a.play(); } catch { setAmb({ playing: false, blocked: true }); }
}
export function pauseAmbient() { el?.pause(); }
export function setAmbientVolume(v: number) { if (el) el.volume = Math.max(0, Math.min(1, v)); }

// ------------------------------------------------------------------ pantalla bloqueada
/** Lo que muestra el reproductor del sistema (pantalla bloqueada, centro de control). */
export function setNowPlaying(info: { title: string; artist: string } | null) {
  const ms = typeof navigator !== "undefined" ? navigator.mediaSession : undefined;
  if (!ms) return;
  if (!info) { ms.metadata = null; return; }
  try {
    ms.metadata = new MediaMetadata({
      title: info.title, artist: info.artist, album: "Remontada",
      artwork: [{ src: new URL("./icon-512.png", location.href).href, sizes: "512x512", type: "image/png" }],
    });
    ms.setActionHandler("play", () => { void el?.play(); });
    ms.setActionHandler("pause", () => { el?.pause(); });
  } catch { /* sin soporte */ }
}

// ------------------------------------------------------------------ música del parque
// Pad suave en pentatónica con notas sueltas y eco. Se genera en vivo y solo suena con la app abierta.
let music: { stop: () => void } | null = null;
export function startParkMusic() {
  if (music) return;
  const c = ctx(); if (!c) return;
  const master = c.createGain(); master.gain.setValueAtTime(0.0001, c.currentTime); master.gain.exponentialRampToValueAtTime(0.16, c.currentTime + 3);
  const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1800;
  const delay = c.createDelay(2); delay.delayTime.value = 0.42;
  const fb = c.createGain(); fb.gain.value = 0.35;
  delay.connect(fb).connect(delay); delay.connect(lp);
  lp.connect(master).connect(c.destination);
  const chords = [[261.6, 329.6, 392], [220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7]];
  const scale = [523.3, 587.3, 659.3, 784, 880, 1046.5];
  let step = 0, next = c.currentTime + 0.1;
  const tick = () => {
    while (next < c.currentTime + 1.5) {
      const ch = chords[step % chords.length];
      for (const f of ch) {
        const o = c.createOscillator(), g = c.createGain(); o.type = "sine"; o.frequency.value = f / 2;
        g.gain.setValueAtTime(0.0001, next); g.gain.exponentialRampToValueAtTime(0.09, next + 1.6); g.gain.exponentialRampToValueAtTime(0.0001, next + 4.4);
        o.connect(g).connect(lp); o.start(next); o.stop(next + 4.6);
      }
      for (let k = 0; k < 3; k++) {
        if (Math.random() < 0.55) {
          const t = next + k * 1.33 + Math.random() * 0.2, f = scale[Math.floor(Math.random() * scale.length)];
          const o = c.createOscillator(), g = c.createGain(); o.type = "triangle"; o.frequency.value = f;
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
          o.connect(g); g.connect(lp); g.connect(delay); o.start(t); o.stop(t + 1.3);
        }
      }
      next += 4; step++;
    }
  };
  tick();
  const iv = window.setInterval(tick, 500);
  music = {
    stop: () => {
      window.clearInterval(iv);
      const t = c.currentTime; master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t); master.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
      window.setTimeout(() => master.disconnect(), 1000);
      music = null;
    },
  };
}
export function stopParkMusic() { music?.stop(); }
